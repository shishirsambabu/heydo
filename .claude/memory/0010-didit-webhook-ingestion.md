# 0010 — Didit webhook ingestion
- Date: 2026-06-17
- Phase: 1
- Decider: Trust Architect + Security Sentinel + Platform Architect
- Status: accepted

## Decision
Add a public Didit webhook endpoint at `POST /webhooks/didit`.

## Why
Polling Didit is useful for local smoke tests, but the real Phase 1 gate needs vendor-pushed updates so VKYC decisions are ingested even if the worker completes the hosted flow later.

## Implementation
- Verifies Didit's HMAC signature, preferring `X-Signature-V2`.
- Falls back to `X-Signature-Simple` only for envelope authentication.
- Rejects webhook timestamps older than 5 minutes.
- Processes only final session events (`Approved`, `Declined`) from `status.updated` / `data.updated`.
- Re-fetches the final decision from Didit before mutating Heydo verification state.
- Treats duplicate deliveries as successful idempotent no-ops.

## Remaining Work
- Configure the destination in Didit Business Console with a public HTTPS backend URL.
- Store the destination secret as `DIDIT_WEBHOOK_SECRET`.
- Use Didit's Try Webhook tool against the deployed endpoint before real traffic.
