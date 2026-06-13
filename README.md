# FacePay Transit System

A monorepo for a transit payment prototype: passengers enroll with face recognition, link a payment card, and board buses via a terminal that identifies them and charges a fare automatically. All persistent data is stored in **Supabase** (PostgreSQL).

---

## Quick start tutorial

Follow every step in order. Each step includes a **Verify** checkpoint so you know it worked before moving on.

### What you need

| Requirement | Notes |
| --- | --- |
| [Node.js](https://nodejs.org/) 20+ | Tested with v22 |
| [pnpm](https://pnpm.io/) 10+ | `npm install -g pnpm` |
| [Python](https://www.python.org/) 3.10+ | 3.12 recommended |
| [Supabase](https://supabase.com) account | Free tier is fine |
| Webcam | Required for face enrollment and bus terminal |

---

### Step 1 — Create a Supabase database

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**, pick a name and password, and wait for provisioning (~2 min).
3. Open **Project Settings → Database**.
4. Under **Connection string**, select **URI** and **Transaction pooler** (port `6543`).
5. Copy the URI. It looks like:

   ```
   postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```

6. Replace `[YOUR-PASSWORD]` with the database password you chose in step 2.

> **Verify:** The URI contains `pooler.supabase.com:6543` and your real password (not the placeholder).

---

### Step 2 — Install JavaScript dependencies

Open **PowerShell** in the project root (`Pay/`):

```powershell
pnpm install
```

> **Verify:** Command finishes with `Done in …` and no errors. If you see a Rollup or esbuild platform error, run `pnpm install` again after pulling the latest code.

---

### Step 3 — Set up the Python backend

```powershell
cd artifacts\api-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Set your Supabase connection string (paste your real URI):

```powershell
$env:DATABASE_URL = "postgresql://postgres.xxxxxxxxxxxx:YOUR-PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
$env:PORT = "8080"
```

Start the API:

```powershell
.\start.ps1
```

You should see:

```
Starting FacePay API server on port 8080...
INFO:     Uvicorn running on http://0.0.0.0:8080
INFO:     Database tables ready.
```

> **Verify:** Open a **second** PowerShell window and run:

```powershell
Invoke-RestMethod http://localhost:8080/health
```

Expected output:

```json
status  service
------  -------
ok      FacePay API
```

Also check the API docs at [http://localhost:8080/docs](http://localhost:8080/docs).

**Keep this terminal open** — the API must stay running.

---

### Step 4 — Start the frontend

In the **second** PowerShell window, from the project root:

```powershell
cd path\to\Pay   # your project root
$env:PORT = "5173"
$env:BASE_PATH = "/"
pnpm --filter @workspace/transit-app run dev
```

You should see:

```
VITE v7.x  ready
➜  Local:   http://localhost:5173/
```

> **Verify:** Open [http://localhost:5173](http://localhost:5173) in your browser. You should see the FacePay home page.

> **Verify API proxy:** With both servers running, open [http://localhost:5173/api/healthz](http://localhost:5173/api/healthz). You should get `{"status":"ok"}` (or similar). This confirms the frontend is forwarding `/api` requests to the backend.

---

### Step 5 — Register a test user

1. Go to [http://localhost:5173/register](http://localhost:5173/register).
2. Allow **camera access** when prompted.
3. Complete the three face capture steps (straight, left, right).
4. Enter your name and email, then submit.

> **Verify:** You are redirected to `/dashboard/{id}`. The dashboard shows your profile.

---

### Step 6 — Link a payment card

1. From the dashboard, go to **Link Card** (or open `/card/{id}`).
2. Enter any test card details (this is a prototype — no real payment processor):
   - Card number: `4111111111111111`
   - Holder name: your name
   - Expiry: `12/28`
3. Submit.

> **Verify:** Dashboard shows a card balance (starts at $50.00 after linking).

---

### Step 7 — Test the bus terminal

1. Open [http://localhost:5173/bus](http://localhost:5173/bus) (use the same browser or a second device on your network).
2. Allow camera access.
3. Look at the camera — the terminal should recognize your enrolled face and charge the $1.50 fare.

> **Verify:** You see a success message with your name and remaining balance.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `DATABASE_URL environment variable is required` | Set `$env:DATABASE_URL` before starting the API (Step 3). |
| `Cannot find module @rollup/rollup-win32-x64-msvc` | Run `pnpm install` from the project root. |
| Frontend loads but API calls fail (network errors) | Make sure the API is running on port 8080 and you started the frontend **after** setting `$env:PORT` and `$env:BASE_PATH`. |
| `Connection refused` to Supabase | Double-check the URI, password, and that your Supabase project is active. Use the **transaction pooler** URI (port 6543). |
| Camera not working | Use `localhost` (browsers allow camera on localhost). On mobile, use the Network URL from Vite (e.g. `http://192.168.x.x:5173`). |
| Face not recognized at bus terminal | Re-register with good lighting. Face must be enrolled on the same device/browser for best results. |
| `pip install` very slow or fails on TensorFlow | Use the current `requirements.txt` — it no longer includes TensorFlow/deepface. Delete `.venv` and recreate if you installed old deps. |

---

## Architecture

```
┌─────────────────────┐     /api/* (proxied)   ┌──────────────────────┐
│  transit-app        │ ─────────────────────► │  api-server          │
│  localhost:5173     │                        │  localhost:8080      │
└─────────────────────┘                        └──────────┬───────────┘
                                                             │ SQLAlchemy
                                                             ▼
                                                  ┌──────────────────────┐
                                                  │  Supabase PostgreSQL │
                                                  └──────────────────────┘
```

| Layer | Stack |
| --- | --- |
| Database | Supabase (PostgreSQL) |
| Backend | Python, FastAPI, SQLAlchemy, OpenCV |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query |
| API contract | OpenAPI → Orval-generated clients in `lib/` |
| Deployment | Render (`render.yaml`) |

---

## Environment variables

Copy `.env.example` to `.env` for reference. The apps read variables from the shell environment (PowerShell `$env:…`).

### API server (`artifacts/api-server`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | **Yes** | — | Supabase PostgreSQL URI |
| `PORT` | No | `8080` | HTTP port |

### Frontend (`artifacts/transit-app`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | **Yes** | — | Vite dev server port (use `5173`) |
| `BASE_PATH` | **Yes** | — | App base path (use `/` locally) |
| `API_URL` | No | `http://localhost:8080` | Backend URL for the Vite `/api` proxy |

---

## Repository layout

| Path | Description |
| --- | --- |
| `artifacts/api-server` | FastAPI backend — face recognition, users, payments, bus terminal |
| `artifacts/transit-app` | Passenger and bus-terminal web app |
| `artifacts/mockup-sandbox` | UI component preview sandbox |
| `lib/api-spec` | OpenAPI spec and Orval codegen |
| `lib/api-client-react` | Generated React Query API client |
| `lib/api-zod` | Generated Zod schemas |
| `lib/db` | Drizzle ORM utilities |
| `scripts` | Repo utility scripts |

---

## Supabase details

- **SSL:** The backend auto-appends `sslmode=require` when the URL contains `supabase`.
- **Pooler:** Transaction pooler (port 6543) is recommended for both local dev and Render deployment.
- **Schema:** Tables (`users`, `cards`, `transactions`, `bus_stats`) are created automatically on API startup — no manual SQL migration needed.

---

## Build & deploy

Build all workspace packages:

```powershell
pnpm run build
```

Regenerate API clients after editing `lib/api-spec/openapi.yaml`:

```powershell
pnpm --filter @workspace/api-spec run codegen
```

### Render deployment

1. Connect the repo to [Render](https://render.com).
2. Set `DATABASE_URL` in the Render dashboard to your Supabase **transaction pooler** URI.
3. Deploy — `render.yaml` runs `bash start.sh` from `artifacts/api-server`.
4. Health check: `GET /health`.

---

## API overview

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
| `POST` | `/api/bus/pay` | Bus terminal face payment |
| `GET` | `/api/bus/stats` | Aggregate boarding stats |

Interactive docs: [http://localhost:8080/docs](http://localhost:8080/docs) when the API is running.

---

## App routes

| Route | Page |
| --- | --- |
| `/` | Home |
| `/register` | Registration + face enrollment |
| `/login` | Face-based login |
| `/dashboard/:id` | User dashboard |
| `/card/:id` | Link / manage payment card |
| `/bus` | Bus terminal |
| `/users` | Admin user list |

---

## License

MIT
