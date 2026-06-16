# 0005 — Phase 1 HTTP API + Flutter onboarding built & verified
- Date: 2026-06-15
- Phase: 1
- Decider: Trust Architect + Mobile Grandmaster (under Supreme Architect)
- Status: accepted (in progress)

## Progress
Extended the Phase 1 backend trust core (see [0004](0004-phase-1-backend-trust-core.md)) with the full HTTP layer, and installed Flutter + built the onboarding app.

**Backend HTTP API (NestJS) — verified end-to-end over HTTP on a live server:**
- Auth (`/auth/otp/request|verify` → JWT), Identity (`/identity/me|role|worker-profile`), Verification (`/verification/consent|start|result|status`), Admin queue (`/admin/verifications/pending|:id/approve|:id/reject`).
- `JwtAuthGuard` + `RolesGuard` + `@Roles`/`@CurrentUser`; `SecurityModule` (shared JWT, no module cycles); dev-only admin login.
- Live run proved: signup → role → consent → VKYC start → vendor result → **cannot apply** → officer approves → **canApply=true**; admin queue payload has **no Aadhaar token**; worker JWT → **403** on admin queue. 21 unit tests green; tsc clean.

**Flutter app (`apps/mobile`) — installed SDK + built + verified:**
- Flutter SDK cloned to `D:\flutter` and bootstrapped.
- Malayalam-first onboarding: language → phone → OTP → role → consent + live VKYC → status. Accessibility-first widgets; `HeydoApi` client → backend; `AppState` (Provider).
- **`flutter analyze` clean; `flutter test` 2/2 pass** (incl. Malayalam-first assertion).

## Environment
- Flutter now installed (`D:\flutter`); Node 22 present. No emulator/device, so the app can't be *launched* here — but it analyzes and unit-tests clean.
- npm installs need `--ignore-scripts`; flutter installed via shallow git clone of `stable`.

## Next
Next.js admin **VKYC Verification Queue** UI; Prisma/Postgres schema; real VKYC vendor swap; device run-through for the Phase 1 gate. Tracked in `docs/phase-1/PROGRESS.md`.
