# 0008 — Didit VKYC + AWS free account unblock
- Date: 2026-06-17
- Phase: 1
- Decider: Trust Architect + Security Sentinel (under Supreme Architect)
- Status: accepted

## Decision
Use **Didit** as the first live VKYC vendor path for Phase 1. The founder has signed up on Didit's free plan. The founder has also created a free AWS account, so the next infrastructure step can be a dev stack rather than more local-only scaffolding.

## Implementation
- Added `DiditVkycProvider` behind the existing `VkycProvider` seam.
- `VKYC_PROVIDER=didit` selects Didit; `mock` remains the default for local development and CI.
- Didit API keys remain backend-only via `.env` / future Secrets Manager.
- The adapter creates hosted Didit sessions and retrieves final decision signals.
- Heydo stores opaque Didit session references in the PII vault path, not Aadhaar numbers, document images, selfies, or media bytes.
- Public Didit docs do not list Malayalam (`ml`) as a supported hosted-flow language yet, so Heydo keeps Malayalam-first pre-verification UX and falls back to `DIDIT_LANGUAGE_FALLBACK` inside Didit.

## Validation
- Backend tests: 24 passing / 5 suites.
- Backend TypeScript build: clean.

## Remaining Gate Work
- Create/publish the Didit KYC workflow and configure API/Webhook credentials locally.
- Add signed Didit webhook ingestion before relying on asynchronous vendor callbacks.
- Provision AWS dev infrastructure: RDS Postgres, KMS/Secrets Manager, S3, least-privilege IAM.
- Swap in-memory repositories to Postgres-backed implementations.
- Run the full worker VKYC path on a real Android device in Malayalam.
