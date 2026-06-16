# Phase 1 — Identity Loop (VKYC): Progress

> **Goal:** a worker can sign up, pass live VKYC (Aadhaar-linked), and exist as a verified
> identity; a giver can sign up. Lead: Trust Architect. See [roadmap](../../HEYDO_OPERATING_SYSTEM.md) § Phase 1.

## Status: 🟢 Code-complete in this environment — gate pending external deps (vendor, RDS, device)

### ✅ Done (built + verified green in this environment)
The backend **identity/verification domain** — the trust-critical heart of Phase 1:
- **OTP auth** (`auth/otp/`) — request/verify with expiry, attempt-lockout, resend throttle, single-use. Hardened against brute force.
- **PII vault** (`common/pii/pii-vault.ts`) — AES-256-GCM; services hold only opaque vault references, never raw Aadhaar. DPDP erasure supported.
- **PII redaction** (`common/pii/redaction.ts`) — log-safe masking; forbidden keys (aadhaar/otp/token/face) stripped everywhere.
- **Audit log** (`common/audit/`) — append-only; signals only, never PII.
- **VKYC provider abstraction** (`verification/vkyc/`) — swappable; `MockVkycProvider` for dev so the flow runs without a signed vendor.
- **Verification state machine** (`verification/verification.service.ts`) — consent → start → vendor result → officer review → approve/reject; auto-reject on liveness/Aadhaar/face-match failure; `canApply()` trust gate; verification expiry.

**Tests: 21 passing / 4 suites** (`npm test`). Key proofs:
- VKYC cannot be bypassed: `canApply` is false until an officer approves.
- The **raw Aadhaar token is never** on the record, in the store, or in the audit log — only a vault reference resolves it.
- Hard-fail VKYC results auto-reject and block approval.
- Vendor results are idempotent (can't double-process).
- Expired approvals lose eligibility.

Backend also **type-checks and builds clean** (`tsc` → `dist/main.js`); boots a `/health` endpoint.

### ✅ Done — Backend HTTP layer + DI (proven end-to-end over HTTP)
Wired the full REST API and ran the complete flow against a live server:
- `AuthController` — `POST /auth/otp/request` (dev returns the mock code), `POST /auth/otp/verify` → JWT + user.
- `IdentityController` — `GET /identity/me`, `POST /identity/role`, `PATCH /identity/worker-profile` (JWT-guarded).
- `VerificationController` — `POST /verification/consent`, `/start`, `/result` (vendor webhook sim), `GET /status`.
- `AdminVerificationController` — `GET /admin/verifications/pending`, `POST /:id/approve`, `/:id/reject` — **RBAC: `verification_officer` only**.
- Guards (`JwtAuthGuard`, `RolesGuard`), `@Roles`/`@CurrentUser` decorators, `SecurityModule` (shared JWT, no module cycles), dev-only admin login.

**Live e2e run proved:** signup → role → consent → VKYC start → vendor result → *still can't apply* → officer approves → **canApply=true**; the admin queue payload **never contains the Aadhaar token**; a worker JWT gets **403** on the admin queue. Backend type-checks clean; 21 unit tests still green.

### ✅ Done — Flutter app onboarding (SDK installed + analyzed + tested)
Installed the Flutter SDK (`D:\flutter`) and built the **Malayalam-first onboarding flow** in `apps/mobile`:
- Screens: language → phone → OTP → role → DPDP consent + live VKYC → status — accessibility-first (large tap targets, big legible type, icons + text).
- `HeydoApi` client calling the exact backend endpoints above; `AppState` (Provider) drives the flow.
- Strings are **Malayalam-default / English-secondary** via a localization layer — no hard-coded English in any widget.
- **`flutter analyze` → "No issues found!"**; **`flutter test` → 2/2 passed** (incl. a test asserting Malayalam is offered first).
- ⚠️ Can't launch on an emulator/device in this environment (none attached), but the code compiles, analyzes, and unit-tests clean.

### ✅ Done — Admin web (Next.js) VKYC Verification Queue (built + verified)
`apps/admin-web` (Next.js 14 App Router, brand-styled):
- **Officer sign-in** (`/login`) → dev admin login → JWT.
- **VKYC Verification Queue** (`/verifications`) → lists pending, shows liveness / Aadhaar-match / face-match **signals only**, with **Approve / Reject** (reason) calling the backend admin API.
- Brand applied: palette tokens + bundled Inter / Plus Jakarta Sans (offline-first); "Hey·do" mark.
- **`next build` clean** (6 routes, types valid). Live integration proven: officer login → queue returns a seeded pending verification with **no Aadhaar token in the payload**; pages serve (HTTP 200), brand font serves (HTTP 200).

### ✅ Done — Persistence schema (reference)
`apps/backend/prisma/schema.prisma` — the full PostgreSQL model (identity, verification, marketplace, reputation, **double-entry ledger**, audit) matching the repository interfaces. Wired to RDS at deployment.

### ⏳ Not buildable here — external gate dependencies
These need real-world resources, not more code, to close the Phase 1 gate:
1. **Real VKYC vendor**: swap `MockVkycProvider` → Signzy/HyperVerge (needs a signed vendor contract + sandbox creds). The adapter seam is ready.
2. **Postgres/AWS**: provision RDS + run the Prisma schema; swap in-memory repos → DB repos.
3. **Device run-through**: run the Flutter app on a real mid-range Android phone, in Malayalam, end-to-end (needs a device/emulator).
4. **Security sign-off**: Security Sentinel review of the PII vault + admin RBAC (formal Phase 7 hardening, but a first pass now).

## Environment notes
- ✅ Node 22 present — backend + admin web build & run here.
- ⚠️ **Flutter / Dart not installed** — app code will be written but must be run on a machine with the Flutter SDK.
- ⚠️ Docker/Postgres not present — backend runs on in-memory repos for dev; Postgres wiring is deployment-time.
- `npm install` needs `--ignore-scripts` here (NestJS postinstall can't spawn a shell in this sandbox).

## Phase 1 gate (from the roadmap)
> A real worker in Kerala completes VKYC end-to-end on a mid-range Android phone, in Malayalam; a Verification Officer reviews and approves it in the admin panel; PII handled per rules. Security Sentinel signs off on the PII vault.

Backend logic for this gate is done and tested. Remaining: the Flutter VKYC UI, the admin queue UI, the real vendor integration, and a device run-through.
