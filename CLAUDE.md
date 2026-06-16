# CLAUDE.md — Heydo

> This file is loaded into context at the start of every session. It tells any agent
> working in this repo **what Heydo is, how this repo is organized, and the rules of engagement.**

---

## 1. What we are building

**Heydo** — *"Hey, do this for me."*

A trust-first, **applicant-model** local gig marketplace for Kerala (then India), where:

- **Gig givers** post a job ("fix my pipe in Thrissur tomorrow morning").
- **Verified workers apply**, and the giver **chooses** — the Airbnb model applied to local gigs, *not* the dispatch model everyone else uses.
- Every worker passes **live VKYC (Aadhaar-linked video verification)** before they can apply.
- Money sits in **escrow** and is released on confirmed completion.
- Workers keep **85%** of the payout, build a portable **Heydo Score**, and are protected by **dual-side ratings** + **per-gig micro-insurance**.

The long game: become the **trust infrastructure of the informal economy** — a verified-identity + reputation + payments rail that the whole gig economy is built on. See [TRUST_INFRASTRUCTURE_SINGULARITY.md](.claude/TRUST_INFRASTRUCTURE_SINGULARITY.md).

**Wedge market:** Kerala. **Beachhead supply:** Kudumbashree (4.5M women members). **Language:** Malayalam-first.

---

## 2. The 15 USPs (our non-negotiable differentiators)

1. Applicant model (apply + choose), not dispatch
2. Full live VKYC, Aadhaar-linked
3. Creative & lifestyle gig category (musicians, mehendi, pet care, comedy…)
4. 85% payout to workers (industry-highest)
5. Malayalam-first UI
6. Full payment escrow
7. Dual-side ratings (workers rate employers too)
8. Per-gig micro-insurance
9. **Heydo Score** — portable trust identity
10. Gig bundles for events
11. Skill certification badges
12. WhatsApp-native gig posting
13. B2B gig contracts (verified workforce pools)
14. Gig savings wallet + RuPay card (neobank path)
15. Government partnership (Kudumbashree)

These are the spec. If a design or implementation decision weakens one of these, flag it.

---

## 3. Revenue model (7 streams)

Transaction commission (15%) · Worker Pro subscription (₹99/mo) · B2B enterprise contracts · Boosted listings · Insurance margin · Worker wallet + card MDR · Skill certification fees.

---

## 4. How this repo is organized — the "Civilization"

This is not just a codebase; it is a **decision-making organization** expressed as files. Each file is a *lens* — a specialist perspective that reviews and shapes the work.

```
SUPREME_ARCHITECT ── orchestrates everything
   │
   ├─ 13 SOVEREIGNS ── domain owners (product, trust, marketplace, mobile, …)
   │     │
   │     └─ 65 GENIUSES ── deep specialists under each sovereign
   │
   └─ TRUST_INFRASTRUCTURE_SINGULARITY ── the north-star vision
```

- **[HEYDO_CIVILIZATION.md](HEYDO_CIVILIZATION.md)** — the full org map: who owns what, how decisions flow.
- **[HEYDO_OPERATING_SYSTEM.md](HEYDO_OPERATING_SYSTEM.md)** — *how we work*: the phased build roadmap, the review loop, the definition of done.
- **`.claude/sovereigns/`** — 13 domain leaders.
- **`.claude/geniuses/`** — 65 specialists, grouped by domain.
- **`.claude/context/`** — durable facts about the market, users, regulations, competitors.
- **`.claude/rules/`** — hard constraints every agent must respect (security, money, PII, accessibility).
- **`.claude/memory/`** — decisions and learnings accumulated over the build.

### How to use it
When you pick up a task, **consult the relevant sovereign and its geniuses** before acting. A payments change? Read the Trust Architect + escrow/fraud geniuses. A new screen? Read the Experience Oracle + UX/accessibility geniuses. Each file tells you the principles, the quality bar, and the traps.

---

## 5. Engineering ground rules

- **Money is sacred.** Anything touching payments, escrow, wallet, or payouts requires the Trust Architect lens + Security Sentinel review, double-entry accounting, and idempotency. Never lose or double-spend a rupee.
- **PII is radioactive.** Aadhaar/VKYC data follows the rules in `.claude/rules/`. Minimize, encrypt at rest + in transit, never log it, comply with India DPDP Act.
- **Malayalam is not an afterthought.** Every string is localized from day one. No hard-coded English.
- **Offline-first.** Kerala has patchy connectivity in towns beyond Kochi. The app must degrade gracefully.
- **Trust > features.** When in doubt, choose the option that makes a mother comfortable letting a stranger into her home.

### The three surfaces
Heydo ships on **three surfaces**, all on one shared backend:
1. **Mobile app (Android + iOS)** — for workers and givers. Built in **Flutter** from one codebase. The primary product.
2. **Admin / Ops panel (Web)** — for Heydo's internal team: the **VKYC verification queue**, **dispute console**, **fraud/safety monitoring**, **payout & ledger reconciliation**, **B2B & Kudumbashree onboarding**, **user/worker management**, **support**, and **operator/investor dashboards**. Built as a web app (framework decided in Phase 0 — leaning React/Next.js for data-dense ops UI). Strict **role-based access control (RBAC)** and full audit logging, because it touches PII and money.
3. **Backend** — API-first, event-driven; the system of record for identity, gigs, escrow, and the Heydo Score. Serves both the app and the admin panel. See the Platform Architect.

Full admin spec: [`.claude/context/admin_panel.md`](.claude/context/admin_panel.md).

---

## 6. Where the build plan lives

The phased roadmap (Phase 0 → Phase 9) is in **[HEYDO_OPERATING_SYSTEM.md](HEYDO_OPERATING_SYSTEM.md) § Build Roadmap**. We execute **one phase at a time**, gate each phase on a definition-of-done, and only then move on.

---

## 7. Tone

Heydo is warm, conversational, worker-respecting, and proudly Malayali. Copy, design, and product decisions should feel like that. "Just Heydo it."
