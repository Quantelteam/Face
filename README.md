# FacePay Transit System

An autonomous, zero-action face-recognition payment and boarding verification ecosystem designed for public transit networks. Passengers register their face profile once, link a payment method, and board transit vehicles seamlessly without manual action.

---

## System Architecture

The FacePay Transit System is comprised of three core layers designed for edge reliability and centralized settlement:

1. **Vite + React Frontend (`artifacts/transit-app`)**: 
   - **Passenger Portal**: Allows passengers to scan their face across three angles (straight, left, right) to generate a biometric profile, link cards with secure $50 default balances, check transaction history, and view active exemptions.
   - **Bus Terminal Kiosk**: Fullscreen camera terminal mounted on transit vehicles. Automatically detects boarding passengers, runs edge face identification, processes fare deduction, and handles status overlays (Approved, Declined, Free Ride, Unknown).

2. **FastAPI Python Backend (`artifacts/api-server`)**:
   - Serves high-performance endpoints for face enrollment, authentication, passenger ledger balance operations, transaction logging, and real-time vehicle entry stats.

3. **PostgreSQL Relational Storage**:
   - Keeps state for users, linked payment instruments, ledger entries, and statistical counts for mismatch auditing.

---

## Key Core Differences & Capabilities

### 1. Zero-Action Transit Payments
Unlike traditional turnstiles, validators, or QR codes that require passenger physical interface or device coordination, boarding is completely passive. A passenger walks past the entry camera, their face is matched against the database, and the fare ($1.50) is automatically settled.

### 2. Resilient Failover & Smart Audit (Backup Mode)
To account for extreme operating conditions—such as winter gear, masks, or inadequate lighting—the system defaults to a fail-soft audit loop:
- The system continuously logs the total number of boarding individuals (using OpenCV motion/face presence checks).
- It compares this boarding tally against successful payment transactions.
- On a ledger mismatch (e.g., 5 boardings but only 3 paid rides), the terminal logs a discrepancy and alerts a transit controller, bypassing hardware blocking without halting service.

### 3. Built-In Social Inclusivity
- **Exempt Categories**: Pensioners, students, children under 16, and veterans are marked in the database (`exemption_type`). Upon face matching, the ledger resolves a zero-fare transaction, and the terminal displays a "Free Ride" approval screen.
- **Unregistered Flow**: If the system detects a passenger not enrolled in the database, it flags them as "Unknown". The driver or transit controllers are alerted to settle the fare manually using traditional payment methods.

---

## Technical Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript 5.9 | Client architecture using modern React state patterns |
| **Styling & Motion** | Tailwind CSS v4 + Framer Motion | Curated dark mode and glassmorphism layouts |
| **API Client** | Orval | Auto-generated React Query hooks from OpenAPI spec |
| **Routing** | Wouter | Lightweight client-side router |
| **Backend Engine** | Python 3.12 + FastAPI | Async REST API orchestration |
| **ORM & DB Connection** | Supabase | Structured queries and connection pooling |
| **Biometric Processing**| OpenCV Haar Cascade | Frontal face crop and local feature extraction |
| **Embedding Engine** | 4x4 Grid LBP Histograms | 1024-dimensional visual descriptor; cosine similarity matching |

---

## Biometric Matching Engine

FacePay avoids heavy deep learning framework overhead (e.g., TensorFlow) to optimize execution speed on resource-constrained hardware:
1. **Enrollment**: Captures three distinct head poses. The face region is isolated via Haar cascade, scaled, and split into a $4 \times 4$ grid. Local Binary Patterns (LBP) are extracted from each cell and concatenated into a 1024-dimensional feature vector.
2. **Biometric Token**: A single-use UUID token is generated containing the average vector of the 3 captures, preventing raw image storage on the server.
3. **Identification**: Cosine similarity is calculated between the incoming frame and registered embeddings. If similarity matches or exceeds the threshold (default `0.30`), identification is successful.

---

## Running the Project

### Prerequisites
- Node.js (v24 or later)
- pnpm (v10 or later)
- Python 3.12+ and `uv` package manager
- PostgreSQL instance running locally or remotely

### Backend Setup
1. Define the database environment variable:
   ```powershell
   $env:DATABASE_URL="postgresql://<username>:<password>@<host>:<port>/<database>"
   ```
2. Run the server using `uv`:
   ```powershell
   uv run --cwd artifacts/api-server uvicorn main:app --host 0.0.0.0 --port 8080 --reload
   ```

### Frontend Setup
1. Install project dependencies:
   ```powershell
   pnpm install
   ```
2. Launch the Vite development server:
   ```powershell
   pnpm --filter @workspace/transit-app run dev
   ```

The application client will be served at `http://localhost:22373` and communicate with the API server at `http://localhost:8080/api`.
