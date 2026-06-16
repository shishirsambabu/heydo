# Phase 0 — Foundation & Blueprint

> The decisions and documents that lock Heydo's foundation before any app code is written.
> Owned by the [Supreme Architect](../../.claude/SUPREME_ARCHITECT.md). This folder **is** the Phase 0 gate.

## Why Phase 0 exists
We lock the foundation once, in writing, so we never re-litigate the stack, the data model, or the journeys mid-build. Everything here is reviewed against the [15 USPs](../../CLAUDE.md#2-the-15-usps-our-non-negotiable-differentiators) and the [3 trust loops](../../.claude/TRUST_INFRASTRUCTURE_SINGULARITY.md).

## The artifacts
| Doc | What it locks |
|---|---|
| [00 — Architecture Brief](00-architecture-brief.md) | The system shape: surfaces, services, event flow, principles |
| [01 — Tech Stack Decision](01-tech-stack-decision.md) | Languages, frameworks, cloud, and the named vendors |
| [02 — Trust-Graph Data Model](02-data-model.md) | Entities, the double-entry escrow ledger, events, PII classification |
| [03 — Core User Journeys](03-user-journeys.md) | The end-to-end flows for giver, worker, and ops |
| [04 — Repo Structure & Environments](04-repo-structure.md) | Monorepo layout, environments, CI skeleton |
| [05 — RBAC & Audit Model](05-rbac-and-audit.md) | Roles, permissions, and audit logging across app + admin |

## Decisions locked (see [memory/0003](../../.claude/memory/0003-phase-0-stack-decision.md))
- **Mobile:** Flutter — Android + iOS.
- **Admin panel:** Web — React + Next.js + TypeScript.
- **Backend:** Node.js + TypeScript + NestJS, event-driven.
- **Datastore:** PostgreSQL (system of record incl. ledger) + Redis (cache/queues) + S3 (media) + a managed event bus.
- **Cloud:** AWS, India regions (Mumbai `ap-south-1`, Hyderabad `ap-south-2`) for data residency.
- **Vendors (working assumptions, swappable):** VKYC → Signzy / HyperVerge / IDfy · Escrow/payments → Razorpay Route / Cashfree Easy-Split · Payouts → RazorpayX / Cashfree Payouts · Insurance → Digit / ACKO / BIMA · WhatsApp → Meta WhatsApp Business Platform · Card/wallet (Phase 9) → RuPay via a licensed PPI partner.

## Phase 0 gate checklist
- [x] `context/` populated (market, users, regulatory, competitors, admin panel)
- [x] `rules/` populated (money, PII, localization, accessibility)
- [x] Tech stack decided and recorded
- [x] Trust-graph data model v0 (incl. escrow ledger + events + PII classes)
- [x] Core user journeys mapped (giver, worker, ops)
- [x] Repo structure + environments + CI skeleton defined
- [x] RBAC + audit model defined
- [x] **Reviewed against all 15 USPs and the 3 trust loops** → see [00 § USP/loop review](00-architecture-brief.md#review-against-the-15-usps--3-loops)
- [x] **Founder sign-off to enter Phase 1** — signed off 2026-06-15

> ✅ **Phase 0 COMPLETE (signed off 2026-06-15).** We are now in **Phase 1 — Identity Loop (VKYC).**
