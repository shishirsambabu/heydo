# 0001 — Architecture & phased roadmap established
- Date: 2026-06-15
- Phase: 0
- Decider: Supreme Architect
- Status: accepted

## Decision
Established the full Heydo "civilization" architecture and the Phase 0→9 build roadmap, derived from the Billion Dollar Playbook:
- Top-level docs: `CLAUDE.md`, `HEYDO_OPERATING_SYSTEM.md` (the roadmap), `HEYDO_CIVILIZATION.md`.
- `.claude/SUPREME_ARCHITECT.md` + `.claude/TRUST_INFRASTRUCTURE_SINGULARITY.md` (north star).
- 13 sovereigns in `.claude/sovereigns/`, each commanding 5 geniuses (65 total) in `.claude/geniuses/`.
- Supporting `.claude/context/` (market, users, regulatory, competitors), `.claude/rules/` (money, PII, localization, accessibility), and this `.claude/memory/` log.

The roadmap sequences the build as the trust rail: **Identity (Phase 1 VKYC) → Wedge (Phase 2 applicant model) → Money (Phase 3 escrow) → Reputation (Phase 4 Heydo Score) → Trust boosters (Phase 5) → Growth engine (Phase 6) → Hardening (Phase 7) → Pilot (Phase 8) → Scale/neobank (Phase 9).**

## Why
The playbook's thesis is that Heydo wins by becoming the *trust infrastructure of the informal economy*, not just a gig app. The architecture encodes that: every sovereign/genius bends toward the trust loops (Identity → Reputation → Money) and the four moats (VKYC data, Score-as-credential, government partnership, Malayalam network effect). Building in dependency order protects the moats and keeps the wedge sharp.

## Affects
All phases, all sovereigns and geniuses. This is the founding decision; subsequent decisions build on it.

## Next action
We are in **Phase 0 — Foundation & Blueprint.** The next gate is a written architecture brief + trust-graph data model + signed-off tech stack (Flutter client; backend framework; DB; VKYC vendor; payment/escrow partner; insurance partner), reviewed against all 15 USPs and the 3 trust loops. See [HEYDO_OPERATING_SYSTEM.md](../../HEYDO_OPERATING_SYSTEM.md) § Phase 0.
