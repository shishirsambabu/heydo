# 0003 — Phase 0 stack & blueprint decided
- Date: 2026-06-15
- Phase: 0
- Decider: Supreme Architect + Founder
- Status: accepted

## Decision
Locked the Heydo tech stack and produced the Phase 0 blueprint (`docs/phase-0/`).

**Stack (founder-approved):**
- Mobile: **Flutter** (Android + iOS).
- Admin panel: **React + Next.js + TypeScript** (web).
- Backend: **Node.js + TypeScript + NestJS**, modular monolith → event-driven.
- Data: **PostgreSQL** (system of record + double-entry ledger) + **Redis** + **S3** + **SNS/SQS** event bus.
- Cloud: **AWS**, India regions — `ap-south-1` (Mumbai) primary, `ap-south-2` (Hyderabad) DR. PII + money stay in India.
- IaC **Terraform**, containers **ECS/Fargate**, CI **GitHub Actions**, observability **OTel→CloudWatch/Grafana** (no PII in logs).

**Vendors (working assumptions, behind swappable adapters):** VKYC → Signzy/HyperVerge/IDfy · escrow → Razorpay Route/Cashfree Easy-Split · payouts → RazorpayX/Cashfree Payouts · insurance → Digit/ACKO/BIMA · WhatsApp → Meta WABA via BSP · push → FCM+APNs · wallet/RuPay (Phase 9) → licensed PPI partner.

**Blueprint artifacts:** `docs/phase-0/` — architecture brief, stack decision, trust-graph data model (entities + double-entry ledger + events + PII classes), core user journeys, repo structure/CI, RBAC + audit model.

## Why
Node/TS maximizes hiring in India and shares types with the Next.js admin; Postgres is the right system of record for a money/ledger product; AWS India regions satisfy DPDP/RBI data-residency. Modular monolith now keeps us fast; the event backbone lets us split services later. Vendors named concretely (but wrapped) so the blueprint is actionable without locking contracts.

## Affects
All future phases. Phase 1 build scaffolds this stack. Builds on [0001](0001-architecture-and-roadmap.md) and [0002](0002-three-surfaces-and-admin-panel.md).

## Open items before Phase 1 build
VKYC vendor bake-off; escrow/payout provider selection; insurance sandbox; AWS org + Terraform baseline. Then founder sign-off on the Phase 0 gate.
