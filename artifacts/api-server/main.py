"""
FacePay Transit - FastAPI Backend
Face recognition-based transit payment system.
"""
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

import face_service
from database import Base, engine, get_db
from models import Card, Transaction, User

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("facepay")

BUS_FARE = 1.50

EXEMPTION_LABELS = {
    "child": "Child (under 16)",
    "elderly": "Elderly",
    "disabled": "Disabled",
    "veteran": "Veteran",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready.")

    # Run lightweight migrations for columns added after initial table creation
    try:
        inspector = inspect(engine)
        cols = [c["name"] for c in inspector.get_columns("users")]
        if "exemption_type" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN exemption_type VARCHAR(50)"))
                conn.commit()
            logger.info("Migration: added exemption_type column to users.")
    except Exception as e:
        logger.warning(f"Migration check failed (may already exist): {e}")

    # Pre-warm face detector in background
    import threading
    def _warm():
        try:
            face_service._get_cascade()
            logger.info("Face detector pre-warmed.")
        except Exception as e:
            logger.warning(f"Face detector warm-up failed: {e}")
    threading.Thread(target=_warm, daemon=True).start()
    yield
    logger.info("Shutdown complete.")


app = FastAPI(title="FacePay Transit API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────

class FaceEnrollRequest(BaseModel):
    images: List[str]


class FaceEnrollResponse(BaseModel):
    embedding_token: str
    face_detected: bool
    message: str


class UserRegistrationRequest(BaseModel):
    name: str
    embedding_token: str
    exemption_type: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    name: str
    face_enrolled: bool
    created_at: str
    exemption_type: Optional[str] = None


class FaceIdentifyRequest(BaseModel):
    image: str


class FaceIdentifyResponse(BaseModel):
    identified: bool
    user_id: Optional[int] = None
    name: Optional[str] = None
    confidence: float


class CardRequest(BaseModel):
    card_number: str
    card_holder: str
    expiry: str


class CardResponse(BaseModel):
    id: int
    user_id: int
    last_four: str
    card_holder: str
    balance: float
    linked_at: str


class UserProfileResponse(BaseModel):
    id: int
    name: str
    face_enrolled: bool
    created_at: str
    exemption_type: Optional[str] = None
    card: Optional[CardResponse] = None


class TopUpRequest(BaseModel):
    amount: float


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    amount: float
    transaction_type: str
    description: str
    created_at: str


class UserStatsResponse(BaseModel):
    total_rides: int
    total_spent: float
    current_balance: float
    rides_this_month: int
    avg_fare: float


class BusPayRequest(BaseModel):
    image: str


class BusPayResponse(BaseModel):
    success: bool
    message: str
    is_unknown: bool = False
    is_free_ride: bool = False
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    exemption_type: Optional[str] = None
    amount_charged: Optional[float] = None
    remaining_balance: Optional[float] = None
    confidence: Optional[float] = None


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _fmt_dt(dt: Optional[datetime]) -> str:
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        name=user.name,
        face_enrolled=user.face_enrolled,
        created_at=_fmt_dt(user.created_at),
        exemption_type=user.exemption_type,
    )


def _card_to_response(card: Card) -> CardResponse:
    return CardResponse(
        id=card.id,
        user_id=card.user_id,
        last_four=card.last_four,
        card_holder=card.card_holder,
        balance=round(card.balance, 2),
        linked_at=_fmt_dt(card.linked_at),
    )


def _tx_to_response(tx: Transaction) -> TransactionResponse:
    return TransactionResponse(
        id=tx.id,
        user_id=tx.user_id,
        amount=round(abs(tx.amount), 2),
        transaction_type=tx.transaction_type,
        description=tx.description,
        created_at=_fmt_dt(tx.created_at),
    )


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/api/healthz")
def health_check():
    return {"status": "ok"}


@app.post("/api/auth/enroll-face", response_model=FaceEnrollResponse)
def enroll_face(body: FaceEnrollRequest):
    if not body.images:
        raise HTTPException(400, "No images provided.")
    token, detected, msg = face_service.enroll_faces(body.images)
    if not detected or not token:
        raise HTTPException(400, msg)
    return FaceEnrollResponse(embedding_token=token, face_detected=True, message=msg)


@app.post("/api/auth/register", response_model=UserResponse, status_code=201)
def register_user(body: UserRegistrationRequest, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name is required.")
    emb = face_service.decode_embedding_token(body.embedding_token)
    if emb is None:
        raise HTTPException(400, "Invalid embedding token.")
    valid_exemptions = {"child", "elderly", "disabled", "veteran", None}
    if body.exemption_type not in valid_exemptions:
        raise HTTPException(400, f"Invalid exemption_type. Must be one of: child, elderly, disabled, veteran.")
    user = User(
        name=body.name.strip(),
        face_enrolled=True,
        face_embedding=body.embedding_token,
        exemption_type=body.exemption_type,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"Registered user: {user.name} (id={user.id}, exempt={user.exemption_type})")
    return _user_to_response(user)


@app.post("/api/auth/identify", response_model=FaceIdentifyResponse)
def identify_face(body: FaceIdentifyRequest, db: Session = Depends(get_db)):
    users = db.query(User).filter(User.face_enrolled == True, User.face_embedding.isnot(None)).all()
    candidates = [(u.id, u.name, u.face_embedding) for u in users]

    if not candidates:
        return FaceIdentifyResponse(identified=False, confidence=0.0)

    user_id, confidence = face_service.identify_face(body.image, candidates)
    if user_id is None:
        return FaceIdentifyResponse(identified=False, confidence=round(confidence, 2))

    user = db.query(User).filter(User.id == user_id).first()
    return FaceIdentifyResponse(
        identified=True,
        user_id=user_id,
        name=user.name if user else None,
        confidence=round(confidence, 2),
    )


@app.get("/api/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_to_response(u) for u in users]


@app.get("/api/users/{user_id}", response_model=UserProfileResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")
    card_resp = _card_to_response(user.card) if user.card else None
    return UserProfileResponse(
        id=user.id,
        name=user.name,
        face_enrolled=user.face_enrolled,
        created_at=_fmt_dt(user.created_at),
        exemption_type=user.exemption_type,
        card=card_resp,
    )


@app.get("/api/users/{user_id}/card", response_model=CardResponse)
def get_card(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")
    if not user.card:
        raise HTTPException(404, "No card linked.")
    return _card_to_response(user.card)


@app.post("/api/users/{user_id}/card", response_model=CardResponse, status_code=201)
def link_card(user_id: int, body: CardRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")
    if user.card:
        raise HTTPException(400, "Card already linked. Remove existing card first.")
    digits = body.card_number.replace(" ", "").replace("-", "")
    if not digits.isdigit() or len(digits) < 13:
        raise HTTPException(400, "Invalid card number.")
    card = Card(
        user_id=user_id,
        last_four=digits[-4:],
        card_holder=body.card_holder.strip(),
        expiry=body.expiry.strip(),
        balance=50.0,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    tx = Transaction(
        user_id=user_id,
        amount=50.0,
        transaction_type="topup",
        description="Initial balance on card link",
    )
    db.add(tx)
    db.commit()
    return _card_to_response(card)


@app.post("/api/users/{user_id}/card/topup", response_model=CardResponse)
def top_up_card(user_id: int, body: TopUpRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")
    if not user.card:
        raise HTTPException(404, "No card linked.")
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive.")
    user.card.balance += body.amount
    tx = Transaction(
        user_id=user_id,
        amount=body.amount,
        transaction_type="topup",
        description=f"Top-up: ${body.amount:.2f}",
    )
    db.add(tx)
    db.commit()
    db.refresh(user.card)
    return _card_to_response(user.card)


@app.get("/api/users/{user_id}/transactions", response_model=List[TransactionResponse])
def list_user_transactions(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")
    txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(50)
        .all()
    )
    return [_tx_to_response(t) for t in txs]


@app.get("/api/users/{user_id}/stats", response_model=UserStatsResponse)
def get_user_stats(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found.")

    txs = db.query(Transaction).filter(Transaction.user_id == user_id).all()
    rides = [t for t in txs if t.transaction_type == "ride"]
    total_spent = sum(abs(t.amount) for t in rides)

    now = datetime.now(timezone.utc)
    rides_this_month = sum(
        1 for t in rides
        if t.created_at and (
            t.created_at.replace(tzinfo=timezone.utc) if t.created_at.tzinfo is None
            else t.created_at
        ).month == now.month
    )

    avg_fare = total_spent / len(rides) if rides else 0.0
    balance = user.card.balance if user.card else 0.0

    return UserStatsResponse(
        total_rides=len(rides),
        total_spent=round(total_spent, 2),
        current_balance=round(balance, 2),
        rides_this_month=rides_this_month,
        avg_fare=round(avg_fare, 2),
    )


@app.post("/api/bus/pay", response_model=BusPayResponse)
def bus_payment(body: BusPayRequest, db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .filter(User.face_enrolled == True, User.face_embedding.isnot(None))
        .all()
    )
    candidates = [(u.id, u.name, u.face_embedding) for u in users]

    if not candidates:
        return BusPayResponse(
            success=False,
            is_unknown=True,
            message="No registered users in the system.",
        )

    user_id, confidence = face_service.identify_face(body.image, candidates)

    if user_id is None:
        logger.info(f"Bus payment: face not recognized (confidence={confidence:.2f})")
        return BusPayResponse(
            success=False,
            is_unknown=True,
            message="Face not recognized. Unknown person — please alert the driver.",
            confidence=round(confidence, 2),
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return BusPayResponse(success=False, is_unknown=True, message="User not found.")

    # ── FREE RIDE: exempt category ──────────────────────────────────────────
    if user.exemption_type:
        label = EXEMPTION_LABELS.get(user.exemption_type, user.exemption_type.title())
        logger.info(f"Bus payment: FREE RIDE for {user.name} ({label})")
        return BusPayResponse(
            success=True,
            is_free_ride=True,
            message=f"Free ride approved! Welcome, {user.name}.",
            user_id=user_id,
            user_name=user.name,
            exemption_type=user.exemption_type,
            amount_charged=0.0,
            remaining_balance=round(user.card.balance, 2) if user.card else None,
            confidence=round(confidence, 2),
        )

    # ── PAID RIDE ───────────────────────────────────────────────────────────
    if not user.card:
        return BusPayResponse(
            success=False,
            message=f"Welcome, {user.name}! No payment card linked. Please add a card first.",
            user_id=user_id,
            user_name=user.name,
            confidence=round(confidence, 2),
        )

    if user.card.balance < BUS_FARE:
        return BusPayResponse(
            success=False,
            message=f"Insufficient balance. Current: ${user.card.balance:.2f}, Required: ${BUS_FARE:.2f}",
            user_id=user_id,
            user_name=user.name,
            confidence=round(confidence, 2),
            remaining_balance=round(user.card.balance, 2),
        )

    user.card.balance -= BUS_FARE
    tx = Transaction(
        user_id=user_id,
        amount=BUS_FARE,
        transaction_type="ride",
        description=f"Bus fare - ${BUS_FARE:.2f}",
    )
    db.add(tx)
    db.commit()
    db.refresh(user.card)

    logger.info(f"Bus payment: {user.name} charged ${BUS_FARE:.2f}, balance=${user.card.balance:.2f}")

    return BusPayResponse(
        success=True,
        message=f"Payment successful! Have a great ride, {user.name}!",
        user_id=user_id,
        user_name=user.name,
        amount_charged=BUS_FARE,
        remaining_balance=round(user.card.balance, 2),
        confidence=round(confidence, 2),
    )
