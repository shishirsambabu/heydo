# Context — The Admin / Ops Panel (Web)

> Heydo's third surface. The mobile app (Flutter, Android + iOS) is for workers and givers.
> The **admin panel is a web app for Heydo's internal team** — it is how we *operate* the trust rail.
> It touches PII and money, so it is governed by [rules/pii_and_privacy.md](../rules/pii_and_privacy.md),
> [rules/money.md](../rules/money.md), strict RBAC, and full audit logging.

## Why it exists
A trust marketplace cannot run on automation alone. Humans must review verifications, resolve disputes, monitor fraud, reconcile money, and onboard partners. The admin panel is that cockpit.

## Who operates it (roles → RBAC)
- **Verification Officer** — reviews/approves VKYC.
- **Trust & Safety / Dispute Officer** — handles disputes, abuse reports, deactivations.
- **Fraud Analyst** — monitors risk signals, collusion, payout anomalies.
- **Finance / Ops** — payouts, ledger reconciliation, refunds.
- **Partnerships / B2B** — Kudumbashree cohorts, B2B contracts.
- **Support** — user lookups, help.
- **Super Admin** — role/permission management, audit.

Every role is **least-privilege**. PII and money actions are logged with who/what/when/why ([authorization_genius](../geniuses/security/authorization_genius.md)).

## Modules (and which sovereign/genius owns each)
| Module | What it does | Owner lens |
|---|---|---|
| **VKYC Verification Queue** | Review liveness/Aadhaar/face-match results, approve/reject, request re-verify | [identity_verification_genius](../geniuses/trust/identity_verification_genius.md) |
| **Dispute Console** | Work disputes tied to the escrow hold; gather evidence; resolve | [dispute_resolution_genius](../geniuses/trust/dispute_resolution_genius.md) |
| **Fraud & Safety Monitoring** | Risk dashboards, collusion/anomaly flags, SOS/abuse reports, deactivations | [fraud_detection_genius](../geniuses/trust/fraud_detection_genius.md), [worker_safety_genius](../geniuses/trust/worker_safety_genius.md) |
| **Payouts & Ledger** | View/trigger payouts, reconcile the double-entry ledger, handle refunds | [database_genius](../geniuses/data/database_genius.md), Finance |
| **Users & Workers** | Lookup, profiles, Heydo Score detail, account status | [reputation_systems_genius](../geniuses/trust/reputation_systems_genius.md) |
| **Gigs & Categories** | Manage categories (incl. creative/lifestyle), moderate listings | [marketplace_product_genius](../geniuses/product/marketplace_product_genius.md) |
| **B2B & Partnerships** | B2B contracts, Kudumbashree cohort onboarding | [community_genius](../geniuses/growth/community_genius.md) |
| **Operator & Investor Dashboards** | Liquidity, fill rate, disputes, GMV, take-rate, retention | [reporting_genius](../geniuses/data/reporting_genius.md), [analytics_genius](../geniuses/data/analytics_genius.md) |
| **Support Console** | Ticketing, user help, action history | Support |
| **Admin & Audit** | RBAC, audit logs, configuration | [authorization_genius](../geniuses/security/authorization_genius.md) |

## Ownership
- **Build / APIs / RBAC:** [Platform Architect](../sovereigns/PLATFORM_ARCHITECT.md) — same backend & event model as the app.
- **Operate / reliability:** [Reliability Commander](../sovereigns/RELIABILITY_COMMANDER.md).
- **Consoles (verification/dispute/fraud):** [Trust Architect](../sovereigns/TRUST_ARCHITECT.md).
- **Dashboards / data:** [Data Sovereign](../sovereigns/DATA_SOVEREIGN.md).
- **Admin UX:** [Experience Oracle](../sovereigns/EXPERIENCE_ORACLE.md) — clear, fast, error-resistant ops UI (English-first is acceptable for internal staff; user-facing data shown in Malayalam where relevant).

## How it maps to the build phases
The admin panel grows **alongside** the app — you can't run a phase's feature without the tooling to operate it.
- **Phase 0** — decide the web framework (lean React/Next.js); define RBAC model & audit logging.
- **Phase 1** — **VKYC Verification Queue** (you can't enforce VKYC without a way to review it).
- **Phase 2** — **Gigs & Categories** module: manage the category taxonomy (incl. creative/lifestyle), moderate listings, watch the live marketplace.
- **Phase 3** — **Payouts & Ledger** reconciliation views.
- **Phase 4** — **Dispute Console** + **Fraud & Safety Monitoring** + Heydo Score detail.
- **Phase 6** — **B2B & Partnerships** (Kudumbashree onboarding) ops.
- **Phase 7** — admin **security hardening**: RBAC, audit, pen-test (admin is a high-value target).
- **Phase 8** — **Operator dashboards** for running the pilot.
- **Phase 9** — B2B contract management, wallet/finance ops at scale.

## Hard rules for the admin panel
1. RBAC, least-privilege, every sensitive action audited.
2. No PII in logs; PII visible in-panel only to authorized roles, minimized and masked by default.
3. Every money action (payout, refund, release) is authorized, idempotent, and ledger-recorded.
4. The admin panel is a **prime attack target** — it gets the same security rigor as the money paths ([threat_modeling_genius](../geniuses/security/threat_modeling_genius.md), [red_team_genius](../geniuses/security/red_team_genius.md)).
