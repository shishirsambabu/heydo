# 0002 — Three surfaces: mobile (Android + iOS) + web admin panel
- Date: 2026-06-15
- Phase: 0
- Decider: Supreme Architect
- Status: accepted

## Decision
Heydo ships on **three surfaces** on one shared backend:
1. **Mobile app** — Flutter, **Android + iOS** — for workers and givers (the product).
2. **Admin / Ops panel** — **Web** (framework TBD in Phase 0, leaning React/Next.js) — for Heydo's internal team: VKYC verification queue, dispute console, fraud/safety monitoring, payouts & ledger reconciliation, B2B & Kudumbashree onboarding, user/worker management, support, and operator/investor dashboards.
3. **Backend** — API-first, event-driven; serves both surfaces.

The admin panel is built **alongside** the app, phase by phase (you can't run a feature you can't operate): Verification Queue in Phase 1, Payouts/Ledger in Phase 3, Dispute Console + Fraud Monitoring in Phase 4, B2B/Kudumbashree ops in Phase 6, security hardening in Phase 7, operator dashboards in Phase 8.

## Why
A trust marketplace requires human operators to review verifications, resolve disputes, monitor fraud, and reconcile money. The admin panel is the cockpit for the trust rail. It touches PII and money, so it gets strict RBAC, audit logging, and money-grade security (it is a prime attack target).

## Affects
- New spec: [context/admin_panel.md](../context/admin_panel.md).
- Updated: `CLAUDE.md` (§ three surfaces), `HEYDO_OPERATING_SYSTEM.md` (surfaces note + admin scope woven into Phases 0, 1, 3, 4, 6, 7, 8), `HEYDO_CIVILIZATION.md` (surfaces table + admin ownership).
- Lead owners: Platform Architect (build + RBAC), Reliability Commander (ops), Trust Architect (consoles), Data Sovereign (dashboards), Experience Oracle (admin UX), Security Sentinel (admin security).
- Builds on [0001](0001-architecture-and-roadmap.md).
