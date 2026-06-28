# HEYDO OPERATING SYSTEM — How We Build

> The civilization map ([HEYDO_CIVILIZATION.md](HEYDO_CIVILIZATION.md)) says *who* exists.
> This document says *how we work* and *in what order we build.* The phased roadmap below is the
> plan we execute — **one phase at a time, gated by a definition-of-done.**

---

## Part A — The operating loop

Every unit of work runs through the same loop:

```
FRAME → ASSIGN → DESIGN → BUILD → REVIEW → GATE → RECORD
```

1. **Frame** (Supreme Architect): which loop/moat/USP does this serve? Which phase?
2. **Assign**: lead sovereign + supporting sovereigns + named geniuses.
3. **Design**: geniuses apply their principles; produce the approach before code.
4. **Build**: implement to the geniuses' quality bar.
5. **Review**: mandatory lenses — Trust Architect (money/safety/PII), Security Sentinel, Quality Overlord, Experience Oracle.
6. **Gate**: passes the phase's definition-of-done, or it doesn't ship.
7. **Record**: decision + rationale written to `.claude/memory/`.

### The three always-on rules
- **Trust > growth > features.** In that order, every time.
- **Money & PII are sacred.** Double-entry, idempotency, encryption, no logging of secrets.
- **Malayalam-first, offline-tolerant.** From day one, not retrofitted.

---

## Part B — The build roadmap (Phase 0 → Phase 9)

> We build the **trust rail** in dependency order: Identity → Reputation → Money,
> wrapped around a sharp gig-matching wedge. Each phase has an owner, a goal, a scope,
> and a **gate** that must pass before the next phase begins.

### Three surfaces, built together
Every phase ships across the surfaces it needs (see [context/admin_panel.md](.claude/context/admin_panel.md)):
- **Mobile app** — Flutter, **Android + iOS** — for workers & givers (the product).
- **Admin / Ops panel** — **Web** — for Heydo's team to operate that phase's feature (review VKYC, resolve disputes, reconcile money, run dashboards). You cannot run a feature you cannot operate, so the matching admin tooling is part of each phase's gate.
- **Backend** — shared API/event platform behind both.

---

### PHASE 0 — Foundation & Blueprint
**Goal:** lock the decisions so we never re-litigate them. No app code yet — the scaffolding of truth.
**Lead:** Supreme Architect · **Support:** Product Sovereign, Platform Architect, Data Sovereign, Investment Strategist.
**Scope:**
- Finalize the populated `.claude/context/` (market, users, regulation, competitors).
- Finalize `.claude/rules/` (money, PII/DPDP, accessibility, localization).
- Tech stack decision: **Flutter** client, backend language/framework, DB, cloud, VKYC vendor, payment/escrow partner, insurance partner.
- Data model v0 for the **trust graph** (worker, giver, gig, verification, rating, escrow ledger).
- Information architecture + core user journeys (giver posts → workers apply → giver chooses → escrow → completion → dual rating).
- **Surface decisions:** confirm Flutter for Android + iOS; choose the **web admin-panel framework** (lean React/Next.js); define the **RBAC model + audit logging** shared by app and admin.
- Repo structure (mobile app / web admin / backend), environments, CI skeleton.
**Gate:** A written architecture brief + data model + signed-off stack (incl. mobile + web-admin + backend), reviewed against all 15 USPs and the 3 trust loops.

---

### PHASE 1 — Identity Loop: Onboarding + VKYC (the core moat)
**Goal:** a worker can sign up, pass **live VKYC (Aadhaar-linked)**, and exist as a verified identity. A giver can sign up.
**Lead:** Trust Architect · **Support:** Mobile Grandmaster, Security Sentinel, Experience Oracle, Platform Architect.
**Geniuses:** identity_verification, fraud_detection, privacy, authentication, accessibility, mobile_interaction.
**Scope:**
- Phone-OTP auth, role selection (worker / giver / both).
- Worker profile: skills, categories, service area, photo.
- **Live VKYC flow** via vendor (liveness + Aadhaar match), with Malayalam guidance.
- PII vault: encrypted storage, access controls, zero PII in logs, DPDP-compliant consent.
- Giver onboarding (lighter).
- **Admin (web):** VKYC **Verification Queue** — review liveness/Aadhaar/face-match, approve/reject/re-verify, with RBAC + audit. (VKYC cannot be enforced without a way to review it.)
**Gate:** A real worker in Kerala completes VKYC end-to-end on a mid-range Android phone, in Malayalam; a Verification Officer reviews and approves it in the admin panel; PII handled per `.claude/rules/`. Security Sentinel signs off on the PII vault.

---

### PHASE 2 — The Wedge: Gig Posting, Applying, Choosing
**Goal:** the applicant model works end-to-end (no money yet).
**Lead:** Marketplace Grandmaster + Product Sovereign · **Support:** Experience Oracle, Mobile Grandmaster, Data Sovereign.
**Geniuses:** marketplace_product, jobs_to_be_done, supply_liquidity, demand_liquidity, user_journey, simplification.
**Scope:**
- Giver posts a gig (category, description, location, time, budget) — incl. the **creative/lifestyle categories**.
- Workers browse/filter relevant gigs and **apply**.
- Giver sees applicants (with Heydo Score placeholder, ratings, distance) and **chooses**.
- Gig lifecycle states: posted → applied → assigned → in-progress → completed → cancelled.
- Notifications (push + in-app).
- **Admin (web):** **Gigs & Categories** module — manage the category taxonomy (incl. the creative/lifestyle categories), moderate/flag listings, and watch the live marketplace (open gigs, applicant counts, fill rate).
**Gate:** A giver posts a gig, ≥3 verified workers apply, giver selects one, the gig moves through its lifecycle — all in Malayalam, on a real device, offline-tolerant; an admin can manage categories and moderate a listing.

---

### PHASE 3 — Money: Escrow, Payouts, 85% Split
**Goal:** money flows safely. Escrow on acceptance, release on confirmed completion, 85% to worker.
**Lead:** Trust Architect · **Support:** Security Sentinel, Data Sovereign, Platform Architect, Reliability Commander.
**Geniuses:** fraud_detection, database, threat_modeling, authorization, distributed_systems.
**Scope:**
- Payment partner integration (collect from giver).
- **Escrow ledger** — double-entry, idempotent, auditable.
- Release on giver confirmation; auto-release timer + dispute hold.
- **85/15 split**, payout to worker (UPI/bank).
- Refund + cancellation money rules.
- **Admin (web):** Payouts & **Ledger reconciliation** views — inspect escrow state, trigger/track payouts, reconcile the double-entry ledger, process refunds (authorized + audited).
**Gate:** 100% accounting correctness under concurrency and retries (no double-spend, no lost rupee), full audit trail, escrow release tied to completion, and the admin ledger view reconciles to the rupee. Security + Quality + Data sign-off.

---

### PHASE 4 — Reputation Loop: Heydo Score, Dual Ratings, Disputes
**Goal:** trust becomes portable and self-reinforcing.
**Lead:** Trust Architect · **Support:** Data Sovereign, Customer Psychologist, Product Sovereign.
**Geniuses:** reputation_systems, dispute_resolution, worker_safety, analytics, trust_psychology.
**Scope:**
- **Dual-side ratings** (giver rates worker AND worker rates giver) after completion.
- **Heydo Score** computation (ratings, on-time, completion rate, specialties) + display.
- Bad-actor flagging on both sides; abusive-client deactivation.
- **Dispute resolution** flow tied to the escrow hold.
- Worker safety: share-trip/share-gig, SOS, emergency contact.
- **Admin (web):** **Dispute Console** (resolve disputes against the escrow hold) + **Fraud & Safety Monitoring** (risk/anomaly flags, abuse reports, deactivations) + Heydo Score detail view.
**Gate:** Score updates correctly from real ratings; a dispute officer can hold and resolve escrow from the admin Dispute Console; an abusive giver can be flagged and deactivated; fraud signals surface in the monitoring view. Manipulation-resistance reviewed by fraud_detection + red_team.

---

### PHASE 5 — Trust Boosters: Insurance, Badges, Certification
**Goal:** the perception-defining trust features.
**Lead:** Product Sovereign + Trust Architect · **Support:** Integration genius, Investment Strategist.
**Scope:**
- **Per-gig micro-insurance** (BIMA/Digit partner), activated on acceptance.
- **Skill certification** tests → verified **badges** ("Master Plumber", "Top-Rated Painter").
- Badge effect on Score & placement.
**Gate:** Insurance activates per gig with a real partner sandbox; a worker earns a badge that visibly raises standing.

---

### PHASE 6 — Liquidity & Growth Engine: Kudumbashree, WhatsApp, Referrals
**Goal:** fill the marketplace and make it grow itself — focused on Kerala.
**Lead:** Growth Warlord + Marketplace Grandmaster · **Support:** Customer Psychologist, Platform Architect.
**Geniuses:** marketplace_growth, referral, community, viral_loop, network_effects, integration.
**Scope:**
- **Kudumbashree partnership** onboarding pipeline (bulk verified supply).
- **WhatsApp-native gig posting** ("Hey @Heydo fix my pipe…").
- Worker-recruits-worker referral loop (₹0 CAC thesis).
- Dynamic pricing / surge guidance; supply-demand balancing.
- **Admin (web):** **B2B & Partnerships** module — Kudumbashree cohort onboarding pipeline and B2B contract management.
**Gate:** A gig posted via WhatsApp lands in the app; a worker referral converts; a Kudumbashree cohort is onboarded through the admin pipeline in a pilot district.

---

### PHASE 7 — Hardening: Security, Quality, Reliability, Performance
**Goal:** production-grade. The trust rail must never wobble.
**Lead:** Quality Overlord + Security Sentinel + Reliability Commander.
**Geniuses:** red_team, chaos_testing, edge_case, regression, monitoring, incident_response, disaster_recovery, performance_optimization, scalability.
**Scope:**
- Full security review + pen-test of VKYC, escrow, wallet, PII — **including the admin panel** (a prime, high-privilege attack target): RBAC, audit logging, session security.
- Load/chaos testing; offline edge cases; low-end device performance.
- Monitoring, alerting, on-call, runbooks, backups + DR drill.
- App-store readiness (privacy labels, compliance) for **both Android and iOS**.
**Gate:** Pen-test clean on money/PII paths and the admin panel; SLOs defined and met; DR restore proven; app performant on a ₹8k Android phone; iOS + Android builds store-ready.

---

### PHASE 8 — Pilot Launch (Kerala beachhead)
**Goal:** real users, one or two districts (e.g., Thrissur/Kochi).
**Lead:** Growth Warlord + Product Sovereign · **Support:** every sovereign on watch.
**Scope:**
- Soft launch to a controlled cohort (Kudumbashree + organic).
- Instrument the funnel; tight feedback loop; rapid iteration.
- **Admin (web):** **Operator dashboards** (liquidity, fill rate, disputes, payouts, verification queue health) to run the pilot day-to-day.
- B2B pilot: 1–2 hotels/event firms on workforce contracts.
**Gate:** Healthy core loop metrics (verification completion, gig fill rate, repeat rate, dispute rate, payout reliability) at small scale. Investment Strategist confirms the unit-economics story holds.

---

### PHASE 9 — Scale & Neobank Path (Money Loop deepens)
**Goal:** expand districts/categories and open the fintech layer.
**Lead:** Supreme Architect with all sovereigns.
**Scope:**
- **Worker wallet**, instant withdrawal, micro-savings, **RuPay card** (neobank play).
- **B2B contracts** productized; **gig bundles for events**; **Worker Pro** subscription.
- Geographic + category expansion on proven liquidity.
- Series-A-grade metrics & moats.
**Gate:** Proven repeatable district playbook; wallet live with real MDR; the Series A story (from the playbook) is backed by real data.

---

## Part C — Definition of Done (applies to every phase)

A phase is **done** only when:
- [ ] Its gate (above) passes on a **real mid-range Android device**, in **Malayalam**.
- [ ] All money paths are double-entry, idempotent, audited (if applicable).
- [ ] No PII in logs; DPDP consent + encryption verified (if applicable).
- [ ] Trust Architect + Security Sentinel + Quality Overlord have reviewed.
- [ ] None of the 15 USPs were weakened.
- [ ] The decision + rationale is recorded in `.claude/memory/`.

---

## Part D — How we proceed

We execute **phase by phase**. We do **not** start Phase N+1 until Phase N's gate passes. The Supreme Architect owns the gate. When you finish reading this, the next action is always: *"Which phase are we in, and what is the next gate?"*

> Current phase: **Phase 2 - The Wedge: Gig Posting, Applying, Choosing.** The pre-Phase-2 safety evidence gate is complete; see [PROJECT_COMPLETION_METER.md](PROJECT_COMPLETION_METER.md) for the current launch-readiness meter and next gate.
