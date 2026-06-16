# 00 — Architecture Brief

> The shape of the Heydo system. Reviewed by the [Platform Architect](../../.claude/sovereigns/PLATFORM_ARCHITECT.md),
> [Trust Architect](../../.claude/sovereigns/TRUST_ARCHITECT.md), [Security Sentinel](../../.claude/sovereigns/SECURITY_SENTINEL.md), and [Data Sovereign](../../.claude/sovereigns/DATA_SOVEREIGN.md).

## 1. The system at a glance

```
        ┌─────────────────┐     ┌─────────────────────┐
        │  Mobile App      │     │  Admin / Ops Panel  │
        │  Flutter         │     │  Next.js (web)      │
        │  Android + iOS   │     │  Heydo staff        │
        │  workers+givers  │     │  RBAC + audit       │
        └────────┬─────────┘     └──────────┬──────────┘
                 │  HTTPS / REST+JSON        │
                 └────────────┬──────────────┘
                       ┌──────▼───────┐
                       │  API Gateway  │  auth, rate-limit, routing
                       └──────┬───────┘
              ┌───────────────┼─────────────────────────────┐
              │   NestJS modular services (event-driven)     │
              │                                              │
              │  Identity │ Marketplace │ Payments/Escrow    │
              │  Reputation │ Notifications │ Admin/Ops       │
              └───────┬───────────────┬──────────────┬───────┘
                      │               │              │
              ┌───────▼──┐    ┌───────▼────┐   ┌─────▼──────┐
              │PostgreSQL│    │ Event Bus   │   │  Redis      │
              │ (SoR +   │    │ (SNS/SQS or │   │ cache/queue │
              │  ledger) │    │  Kafka)     │   └─────────────┘
              └────┬─────┘    └─────────────┘
                   │
            ┌──────▼─────────┐   ┌──────────────────────────────┐
            │  PII Vault      │   │  External partners (wrapped): │
            │ (isolated, KMS- │   │  VKYC · Escrow · Payouts ·    │
            │  encrypted)     │   │  Insurance · WhatsApp · Card  │
            └────────────────┘   └──────────────────────────────┘
```

## 2. Services (NestJS modules, deployable independently later)
- **Identity** — auth (phone/OTP), profiles, VKYC orchestration, consent. Talks to the PII vault and the VKYC vendor.
- **Marketplace** — gigs, categories, applications, selection, gig lifecycle, matching/ranking.
- **Payments/Escrow** — the double-entry ledger, escrow locks/releases, payouts, refunds, the 85/15 split. Idempotent, audited.
- **Reputation** — Heydo Score computation, dual ratings, badges, disputes (escrow-linked).
- **Notifications** — push (FCM/APNs), in-app, WhatsApp, localized (Malayalam-first).
- **Admin/Ops** — the web panel's backend: verification queue, dispute console, fraud monitoring, reconciliation, dashboards. RBAC-gated.

> Start as a **modular monolith** (one NestJS app, clear module boundaries) for speed; the event-driven design lets us split hot services out later without rewrites.

## 3. Event-driven backbone
State transitions emit durable, ordered events; the Score, notifications, analytics, and the admin panel all react to them. Events are the audit trail and the Score's source of truth. (Full list in [02 § Events](02-data-model.md#5-domain-events).)

## 4. Trust & money guarantees (non-negotiable)
- **Idempotency** on every money/state mutation (idempotency keys + dedup).
- **Double-entry, append-only ledger** in PostgreSQL; corrections via new entries.
- **PII vault isolated** from general services; KMS-encrypted; zero PII in logs.
- **VKYC non-bypassable**: a worker's `verification_status != approved` ⇒ cannot apply.
- **RBAC + audit** on every admin/money/PII action.

## 5. Data residency & cloud
- **AWS, India regions** — primary `ap-south-1` (Mumbai), DR `ap-south-2` (Hyderabad). All PII and money data stays in India (DPDP + RBI alignment).
- Managed services preferred: RDS (PostgreSQL), ElastiCache (Redis), S3 (media), SNS/SQS (events), KMS (keys), Secrets Manager.

## 6. Offline & low-end posture
- Mobile is **offline-first**: cache browseable gigs/profile, queue actions (apply/confirm) with idempotency keys, sync on reconnect.
- APIs return compact payloads and graceful error contracts the app can handle offline.

## 7. Key architectural principles
1. Modular monolith now, service-split later — guided by events, not premature microservices.
2. Vendor wrappers everywhere (VKYC, escrow, insurance, WhatsApp, card) — never hard-couple.
3. Money correctness > everything; cache reads, never cache money truth.
4. Malayalam-first from the schema up (localized fields, not bolt-on translation).
5. Security and audit are designed in Phase 0, not added in Phase 7.

## Review against the 15 USPs & 3 loops
| USP | How the architecture serves it |
|---|---|
| 1 Applicant model | Marketplace service models application → selection explicitly |
| 2 Live VKYC | Identity service + isolated PII vault + VKYC vendor wrapper; non-bypassable flag |
| 3 Creative/lifestyle | Category model with groups; no hard-coding to home services |
| 4 85% payout | Ledger computes the split to paisa with defined rounding |
| 5 Malayalam-first | Localized fields in schema; localization rule enforced |
| 6 Escrow | Payments/Escrow service + double-entry ledger + holds |
| 7 Dual ratings | Reputation service: directional ratings both ways |
| 8 Micro-insurance | Insurance vendor wrapper; policy entity tied to gig |
| 9 Heydo Score | Derived from events, reproducible, auditable |
| 10 Gig bundles | Gig model supports parent/bundle linkage (Phase 9) |
| 11 Skill badges | Badge entity + certification flow |
| 12 WhatsApp posting | Notifications/WhatsApp wrapper + inbound gig intake |
| 13 B2B contracts | Org/account model in admin (Phase 6/9) |
| 14 Wallet + card | Accounts already in the ledger; PPI/card partner later |
| 15 Kudumbashree | Bulk onboarding pipeline in admin (Phase 6) |

| Loop | Served by |
|---|---|
| Identity | Identity service + PII vault + VKYC (Phase 1) |
| Reputation | Reputation service + event-sourced Score (Phase 4) |
| Money | Ledger + accounts + escrow + payouts; wallet path ready (Phase 3 → 9) |

> No USP or loop is blocked by this architecture. Proceed to the data model.
