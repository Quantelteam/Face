# FacePay Transit System

A monorepo for a transit payment prototype: passengers enroll with face recognition, link a payment card, and board buses via a terminal that identifies them and charges a fare automatically. The backend persists all data in **Supabase** (PostgreSQL).

## Features

- **Face enrollment & login** — Capture front, left, and right face images; OpenCV-based detection and embedding matching
- **User profiles** — Registration with optional fare exemptions (child, elderly, disabled, veteran)
- **Payment cards** — Link a card, top up balance, and view transaction history
- **Bus terminal** — Camera-based boarding flow with automatic fare deduction or free-ride approval
- **Admin dashboard** — View registered users and boarding statistics

## Architecture

```
┌─────────────────────┐     HTTP /api/*     ┌──────────────────────┐
│  transit-app        │ ──────────────────► │  api-server          │
│  (React + Vite)     │                     │  (Python FastAPI)    │
└─────────────────────┘                     └──────────┬───────────┘
                                                         │
                                                         │ SQLAlchemy
                                                         ▼
                                              ┌──────────────────────┐
                                              │  Supabase PostgreSQL │
                                              └──────────────────────┘
```

| Layer | Stack |
| --- | --- |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Backend | Python 3.12+, FastAPI, SQLAlchemy, OpenCV |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query |
| API contract | OpenAPI → Orval-generated clients in `lib/` |
| Deployment | [Render](https://render.com) (`render.yaml`) |

## Repository layout

| Path | Description |
| --- | --- |
| `artifacts/api-server` | FastAPI backend — face recognition, users, payments, bus terminal |
| `artifacts/transit-app` | Passenger and bus-terminal web app |
| `artifacts/mockup-sandbox` | UI component preview sandbox |
| `lib/api-spec` | OpenAPI spec and Orval codegen config |
| `lib/api-client-react` | Generated React Query API client |
| `lib/api-zod` | Generated Zod schemas and types |
| `lib/db` | Drizzle ORM utilities (shared TypeScript DB layer) |
| `scripts` | Repo utility scripts |

## Prerequisites

- **Node.js** 24+ and **pnpm** 10+
- **Python** 3.12+
- A **Supabase** project with PostgreSQL enabled

## Supabase setup

### 1. Create a project

1. Sign in at [supabase.com](https://supabase.com) and create a new project.
2. Wait for the database to finish provisioning.

### 2. Get your connection string

In the Supabase dashboard, open **Project Settings → Database** and copy a PostgreSQL connection URI.

**Recommended for production (Render):** use the **Transaction pooler** URI (port `6543`). It works well with serverless and pooled deployments.

**Recommended for local development:** either the **Direct connection** (port `5432`) or the transaction pooler both work.

Replace `[YOUR-PASSWORD]` with your database password.

### 3. Set `DATABASE_URL`

The backend reads a single environment variable:

```powershell
$env:DATABASE_URL = "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

The server automatically appends `sslmode=require` when the URL contains `supabase`, so you do not need to add it manually.

> **Note:** If you use Supabase's transaction pooler (port 6543), the backend is configured with connection pooling settings compatible with PgBouncer transaction mode.

### 4. Database schema

Tables are created automatically when the API starts (`Base.metadata.create_all`). No manual migration step is required for a fresh Supabase project.

| Table | Purpose |
| --- | --- |
| `users` | Profiles, face embeddings, exemption type |
| `cards` | Linked payment cards and balances |
| `transactions` | Ride, top-up, and refund records |
| `bus_stats` | Aggregate boarding and payment counters |

## Local development

### 1. Install workspace dependencies

From the repository root:

```powershell
pnpm install
```

> The root `preinstall` script enforces using `pnpm` (not npm or yarn).

### 2. Start the API server

```powershell
cd artifacts/api-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL = "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
$env:PORT = "8080"
bash start.sh
```

The API listens on `http://localhost:8080`. Health check: `GET /health`.

### 3. Start the transit frontend

In a second terminal, from the repo root:

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
pnpm --filter @workspace/transit-app run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

### 4. Optional — UI sandbox

```powershell
$env:PORT = "5174"
$env:BASE_PATH = "/"
pnpm --filter @workspace/mockup-sandbox run dev
```

## Environment variables

### API server (`artifacts/api-server`)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection URI |
| `PORT` | No | HTTP port (default `8080`; Render uses `10000`) |
| `SECRET_KEY` | No | Reserved for future auth features |

### Frontend (`artifacts/transit-app`, `artifacts/mockup-sandbox`)

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Vite dev/preview server port |
| `BASE_PATH` | Yes | App base path (use `/` for local dev) |

## API overview

Base path: `/api`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health`, `/api/healthz` | Health checks |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/enroll-face` | Enroll face from base64 images |
| `POST` | `/api/auth/identify` | Identify a user by face |
| `GET` | `/api/users`, `/api/users/{id}` | List / get users |
| `GET/POST` | `/api/users/{id}/card` | Get or link payment card |
| `POST` | `/api/users/{id}/card/topup` | Top up card balance |
| `GET` | `/api/users/{id}/transactions` | Transaction history |
| `GET` | `/api/users/{id}/stats` | User ride statistics |
| `POST` | `/api/bus/pay` | Bus terminal face payment |
| `GET` | `/api/bus/stats` | Aggregate boarding stats |

Full request/response schemas live in `lib/api-spec/openapi.yaml`.

## Build

Type-check and build all workspace packages:

```powershell
pnpm run build
```

Regenerate API clients after changing the OpenAPI spec:

```powershell
pnpm --filter @workspace/api-spec run codegen
```

## Deployment

The backend is configured for [Render](https://render.com) via `render.yaml`:

1. Connect this repository to Render.
2. Set `DATABASE_URL` in the Render dashboard to your **Supabase connection URI** (transaction pooler recommended).
3. Render auto-generates `SECRET_KEY` and sets `PORT` to `10000`.
4. Deploy — the service runs `bash start.sh` from `artifacts/api-server`.

Health check path: `/health`.

## Transit app routes

| Route | Page |
| --- | --- |
| `/` | Home |
| `/register` | User registration + face enrollment |
| `/login` | Face-based login |
| `/dashboard/:id` | User dashboard |
| `/card/:id` | Link / manage payment card |
| `/bus` | Bus terminal (driver-facing) |
| `/users` | Admin user list |

## License

MIT
