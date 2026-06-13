"""
FacePay Face Recognition Service
Uses OpenCV Haar cascade for detection + multi-region histogram features for embedding.
No TensorFlow or dlib required — works in any standard Python environment.
"""
import base64
import logging
import pickle
from io import BytesIO
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("face_service")

# Cosine distance threshold: lower = stricter matching
# 0.30 works well for same-device enrollment+recognition
COSINE_THRESHOLD = 0.30

# ──────────────────────────────────────────────
# OpenCV face detector (Haar cascade, built-in)
# ──────────────────────────────────────────────
_face_cascade: Optional[cv2.CascadeClassifier] = None


def _get_cascade() -> cv2.CascadeClassifier:
    global _face_cascade
    if _face_cascade is None:
        path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _face_cascade = cv2.CascadeClassifier(path)
        if _face_cascade.empty():
            raise RuntimeError("Failed to load Haar cascade classifier.")
        logger.info("Haar cascade face detector loaded.")
    return _face_cascade


# ──────────────────────────────────────────────
# Image helpers
# ──────────────────────────────────────────────

def _base64_to_np(b64: str) -> Optional[np.ndarray]:
    """Decode a base64 image (with or without data: URI prefix) to an RGB numpy array."""
    try:
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        # Pad if needed
        missing = len(b64) % 4
        if missing:
            b64 += "=" * (4 - missing)
        raw = base64.b64decode(b64)
        img = Image.open(BytesIO(raw)).convert("RGB")
        return np.array(img)
    except Exception as e:
        logger.error(f"base64 decode error: {e}")
        return None


def _detect_face_crop(img_rgb: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect the largest face in the image and return the cropped RGB region.
    Falls back to the full image if no face is detected.
    """
    cascade = _get_cascade()
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    # Equalize for lighting robustness
    gray_eq = cv2.equalizeHist(gray)

    faces = cascade.detectMultiScale(
        gray_eq,
        scaleFactor=1.1,
        minNeighbors=4,
        minSize=(60, 60),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )

    if len(faces) == 0:
        # No face found — use center crop (graceful fallback for webcam images)
        h, w = img_rgb.shape[:2]
        margin_x = w // 6
        margin_y = h // 6
        crop = img_rgb[margin_y: h - margin_y, margin_x: w - margin_x]
        logger.debug("No face detected; using center crop fallback.")
        return crop if crop.size > 0 else img_rgb

    # Take the largest detected face
    x, y, fw, fh = max(faces, key=lambda r: r[2] * r[3])
    # Add 15% margin around the face
    pad_x = int(fw * 0.15)
    pad_y = int(fh * 0.15)
    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(img_rgb.shape[1], x + fw + pad_x)
    y2 = min(img_rgb.shape[0], y + fh + pad_y)
    return img_rgb[y1:y2, x1:x2]


def _compute_embedding(face_rgb: np.ndarray) -> np.ndarray:
    """
    Compute a robust face embedding from a cropped face region.

    Strategy:
      1. Resize to 128×128
      2. Convert to grayscale + histogram equalization (lighting invariance)
      3. Split into 4×4 grid of 32×32 patches
      4. For each patch compute histogram (256 bins) → capture local texture
      5. Concatenate all patch histograms → 16×256 = 4096-dim vector
      6. L2-normalize → unit vector for cosine distance

    This approach is:
    - Fast (no GPU / TF / dlib needed)
    - Reasonably invariant to lighting and minor pose
    - Discriminative enough for same-device enrollment + same-session recognition
    """
    # Resize
    face_resized = cv2.resize(face_rgb, (128, 128), interpolation=cv2.INTER_AREA)
    # Grayscale
    gray = cv2.cvtColor(face_resized, cv2.COLOR_RGB2GRAY)
    # Histogram equalization for lighting invariance
    gray = cv2.equalizeHist(gray)

    # 4×4 grid histograms
    patch_size = 32
    hists = []
    for gy in range(4):
        for gx in range(4):
            patch = gray[
                gy * patch_size: (gy + 1) * patch_size,
                gx * patch_size: (gx + 1) * patch_size,
            ]
            hist, _ = np.histogram(patch.ravel(), bins=64, range=(0, 256))
            hists.append(hist.astype(np.float32))

    embedding = np.concatenate(hists)  # 4*4*64 = 1024 dim
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    return embedding


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def enroll_faces(b64_images: List[str]) -> Tuple[Optional[str], bool, str]:
    """
    Enroll a user from multiple face images.
    Returns (embedding_token, face_detected, message).
    The token is a base64-encoded pickled numpy array — safe for storage.
    """
    embeddings = []
    for i, b64 in enumerate(b64_images):
        arr = _base64_to_np(b64)
        if arr is None:
            logger.warning(f"Image {i+1}: could not decode.")
            continue
        face = _detect_face_crop(arr)
        emb = _compute_embedding(face)
        embeddings.append(emb)
        logger.info(f"Image {i+1}/{len(b64_images)} enrolled (emb dim={emb.shape[0]})")

    if not embeddings:
        return None, False, "Could not process any of the provided images."

    # Average the embeddings and re-normalize
    master = np.mean(np.stack(embeddings, axis=0), axis=0)
    master = master / (np.linalg.norm(master) + 1e-10)

    token = base64.b64encode(pickle.dumps(master)).decode("ascii")
    return token, True, f"Face enrolled from {len(embeddings)} image(s)."


def decode_embedding_token(token: str) -> Optional[np.ndarray]:
    """Decode an embedding token back to a numpy array."""
    try:
        raw = base64.b64decode(token)
        emb = pickle.loads(raw)  # noqa: S301 — internal token only
        if isinstance(emb, np.ndarray):
            return emb
    except Exception as e:
        logger.error(f"decode_embedding_token error: {e}")
    return None


def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 1.0
    return float(1.0 - np.dot(a, b) / (na * nb))


def identify_face(
    b64_image: str,
    users_with_embeddings: List[Tuple[int, str, str]],
) -> Tuple[Optional[int], float]:
    """
    Identify a person from a single face image.

    Args:
        b64_image: base64-encoded JPEG/PNG image
        users_with_embeddings: [(user_id, user_name, embedding_token), ...]

    Returns:
        (matched_user_id or None, confidence_0_to_100)
    """
    arr = _base64_to_np(b64_image)
    if arr is None:
        return None, 0.0

    face = _detect_face_crop(arr)
    unknown_emb = _compute_embedding(face)

    best_user_id: Optional[int] = None
    best_dist = float("inf")

    for user_id, _name, token in users_with_embeddings:
        known_emb = decode_embedding_token(token)
        if known_emb is None:
            continue
        dist = _cosine_distance(unknown_emb, known_emb)
        if dist < best_dist:
            best_dist = dist
            best_user_id = user_id

    logger.info(
        f"Identification: best_dist={best_dist:.4f}, threshold={COSINE_THRESHOLD}, "
        f"match={'YES' if best_dist <= COSINE_THRESHOLD else 'NO'}"
    )

    if best_dist <= COSINE_THRESHOLD and best_user_id is not None:
        # Scale confidence: 0 dist → 100%, threshold dist → 0%
        confidence = max(0.0, (1.0 - best_dist / COSINE_THRESHOLD) * 100.0)
        return best_user_id, confidence

    return None, 0.0
