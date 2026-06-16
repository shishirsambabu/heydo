# 03 — Core User Journeys

> The end-to-end flows Heydo must nail. Owned by the [Experience Oracle](../../.claude/sovereigns/EXPERIENCE_ORACLE.md) +
> [user_journey_genius](../../.claude/geniuses/experience/user_journey_genius.md). All in **Malayalam-first**, offline-tolerant, large-target UI.

## Journey A — Worker onboarding & verification (Phase 1)
```
Open app → choose language (ml default) → enter phone → OTP
→ pick role: Worker → consent (DPDP) → live VKYC (liveness + Aadhaar + face)
→ "verification under review" → [admin approves] → build profile (skills, categories, photo, area)
→ VERIFIED ✅ can now apply
```
- Emotional job: *"Is this safe? Will my Aadhaar be misused?"* → reassure with clear consent, "we never store your Aadhaar number," progress cues.
- Failure paths: liveness fails (retry guidance), rejected (reason + appeal), network drop (resume).
- **Gate-relevant:** a real worker completes this unaided on a ₹8k Android, in Malayalam; ops approves in the admin queue.

## Journey B — Giver posts a gig (Phase 2)
```
Open app → enter phone → OTP → role: Giver (lighter onboarding)
→ "Post a gig" → category (incl. creative/lifestyle) → describe → location → when → budget
→ posted ✅ → notified as workers apply
```
- Emotional job: *"Can I find someone I trust, fast?"* → show verified badges + Score on applicants.
- Also supported (Phase 6): post via **WhatsApp** ("Hey @Heydo fix my pipe tomorrow, Thrissur").

## Journey C — The applicant model: apply → choose (Phase 2, the wedge)
```
WORKER: browse relevant gigs (by category/distance) → view gig → APPLY (msg, optional price)
GIVER:  sees applicants with [verified ✅, Heydo Score, rating, distance] → compares → CHOOSES one
→ gig ASSIGNED → both notified
```
- This is the differentiator: the **giver chooses**, the worker competes on merit. Protect its feel.

## Journey D — Do the work & money (Phase 3)
```
On assignment → escrow LOCKED (giver's money held safely)
→ worker marks "started" → does the gig → marks "completed"
→ giver CONFIRMS completion → escrow RELEASES → 85% paid to worker, 15% to platform
→ (auto-release timer if giver doesn't confirm; dispute can hold)
```
- Emotional jobs: worker *"Will I get paid?"* (escrow shown locked) · giver *"What if the work is bad?"* (release only on confirm / dispute).

## Journey E — Reputation & dual rating (Phase 4)
```
On completion → GIVER rates WORKER (stars, tags) AND WORKER rates GIVER
→ Heydo Score recomputes → badges may unlock
→ abusive giver can be flagged → ops can deactivate
```

## Journey F — Dispute (Phase 4)
```
Either side raises dispute → escrow HELD → both submit evidence
→ ops Dispute Console reviews → resolution (release / refund / split) → escrow acts → both rated/flagged
```

## Journey G — Ops / admin (web, every phase)
```
Staff logs into admin (RBAC) →
 Verification Officer: review VKYC queue → approve/reject
 Dispute Officer: resolve disputes against escrow
 Fraud Analyst: watch risk signals, deactivate bad actors
 Finance: reconcile ledger, track payouts/refunds
 Partnerships: onboard Kudumbashree cohorts, B2B contracts
 — every action audited
```

## Cross-cutting journey rules
- **Malayalam-first**, icons + (where helpful) voice cues, large tap targets.
- **Every screen** has defined empty / offline / error states.
- **Trust made visible** at each doubt moment: verified ✅, escrow-locked 🔒, insured 🛡️, Score ⭐.
- **Money actions** get unmistakable, reversible-where-possible confirmation.
