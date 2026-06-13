# FacePay Transit

A face-recognition transit payment app — passengers register their face, link a card, and board buses by looking at a camera terminal.

## Run & Operate

- `artifacts/api-server` workflow — Python FastAPI + uvicorn (port 8080, serves `/api`)
- `artifacts/transit-app` workflow — React + Vite frontend (port 22373, serves `/`)
- `pnpm --filter @workspace/transit-app run typecheck` — typecheck the frontend
- `pnpm --filter @workspace/api-spec run codegen` — regenerate React Query hooks from OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4 + shadcn/ui + framer-motion + wouter
- API: Python FastAPI + SQLAlchemy + PostgreSQL
- Face recognition: OpenCV Haar cascade + 4×4 grid histograms (1024-dim, cosine similarity, no TensorFlow)
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not edit manually)
- `artifacts/api-server/main.py` — FastAPI app entrypoint + routes
- `artifacts/api-server/face_service.py` — face enrollment/identification engine
- `artifacts/api-server/models.py` — SQLAlchemy models: users, cards, transactions
- `artifacts/transit-app/src/index.css` — design tokens (deep navy + teal palette, Outfit font)
- `artifacts/transit-app/src/pages/` — all route pages

## Architecture decisions

- Face embeddings are 1024-dim vectors (4×4 grid, 64-bin histogram per cell); enrolled as average of 3 captures; identified by cosine similarity with threshold 0.30.
- Enrollment returns a one-time `embedding_token` (UUID) used to link the face to a newly created user — avoids re-sending images during registration.
- $1.50 bus fare is deducted atomically; insufficient balance returns `success: false` without charging.
- Cards are given a $50.00 starting balance on first link; `last_four` is extracted server-side from the card number.
- Python is installed via Replit module `python-3.12` at `.pythonlibs/bin`; uvicorn run command must export PATH explicitly.

## Product

- **Passenger mode**: Register face (3-angle capture → enrollment → name → dashboard), face login, view balance & transaction history, link payment card, top up balance.
- **Bus Terminal mode**: Kiosk fullscreen camera view, "TAP TO PAY" button triggers face identification + $1.50 fare deduction, shows Approved/Declined overlay.
- **Admin view**: List all registered users with face enrollment status and direct link to each dashboard.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Python API server run command must explicitly set `PATH` and `PYTHONPATH` before calling uvicorn (see workflow config in `artifacts/api-server/.replit-artifact/artifact.toml`).
- The lifespan function pre-warms the Haar cascade via `face_service._get_cascade()` — do not replace this with `_get_deepface` (removed).
- `User` (from `listUsers`) has no `card` field — only `UserProfile` (from `getUser`) includes nested card data.
- Google Fonts `@import url(...)` must be the first line of `index.css`, before `@import "tailwindcss"`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
