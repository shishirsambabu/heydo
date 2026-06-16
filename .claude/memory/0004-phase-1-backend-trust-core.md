# 0004 — Phase 1 backend trust core built & tested
- Date: 2026-06-15
- Phase: 1
- Decider: Trust Architect (lead) + Supreme Architect
- Status: accepted (in progress)

## Decision / progress
Commenced Phase 1 (Identity/VKYC). Scaffolded the monorepo (`package.json` workspaces, `.gitignore`, `tsconfig.base.json`) and built the **backend identity/verification trust core** in NestJS/TypeScript (`apps/backend`):
- OTP auth (expiry, attempt-lockout, resend throttle, single-use).
- PII vault (AES-256-GCM; opaque references; never stores raw Aadhaar).
- PII redaction (log-safe masking; forbidden keys stripped).
- Append-only audit log (signals only, no PII).
- Swappable VKYC provider + MockVkycProvider (runs without a signed vendor).
- Verification state machine: consent → start → vendor result → officer review → approve/reject; auto-reject on hard fail; `canApply()` trust gate; expiry.

**21 Jest tests passing / 4 suites; tsc build clean; /health boots.** Proven: VKYC non-bypassable; raw Aadhaar never persisted/logged (vault-ref only); idempotent vendor results; expired approvals lose eligibility.

## Why
Built the trust-critical, runnable, testable core first (it's the Phase 1 moat and the part this environment can actually verify). Mock vendor + in-memory repos let the full flow run green without vendor contracts, Postgres, or Docker.

## Environment constraints discovered
- Node 22 present; **Flutter/Dart and Docker/Postgres not installed** in this env.
- `npm install` requires `--ignore-scripts` (NestJS postinstall can't spawn a shell in the sandbox).
- Consequence: backend + (coming) Next.js admin run here; Flutter app code is written here but must be run on a Flutter-equipped machine.

## Next
Backend HTTP+DI layer; Next.js admin VKYC queue; Flutter onboarding/VKYC screens; Prisma/Postgres schema. Builds on [0003](0003-phase-0-stack-decision.md). Tracked in `docs/phase-1/PROGRESS.md`.
