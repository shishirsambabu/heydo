# Memory 0013: Pre-Phase-2 giver KYC, gig review, and fair pricing gate

Date: 2026-06-17

Decision:
- Do not begin broad Phase 2 marketplace expansion until gig posters are held to the same trust standard as workers.
- Givers must complete KYC before posting live gigs. Giver KYC uses a separate Didit workflow (`DIDIT_GIVER_WORKFLOW_ID`) and Didit is the review surface for identity decisions.
- Heydo must not maintain a separate admin queue for approving giver identity. Heydo ingests Didit's final webhook/result and syncs the giver profile status.
- Gigs should not automatically go live when the giver is unverified, the description is vague, the request looks unsafe, or the budget is outside category guardrails.
- Worker counteroffers are part of fairness. Workers may propose a higher price in their application.
- Do not charge workers tokens merely to ask for a fair rate. Future tokens may be used for optional boosts or premium proposal visibility only, after free fair-pay correction is protected.

Economics guardrail:
- The 85/15 split remains the product promise: 85% worker payout, 15% platform commission.
- 15% alone may be thin for low-ticket gigs after Didit, AWS/RDS, support review, payment gateway, fraud handling, and insurance costs.
- Before production scale, track contribution margin per completed gig:
  - gross gig value
  - platform commission
  - payment gateway cost
  - verification cost amortized by repeat gigs
  - support/admin minutes
  - infrastructure cost allocation
  - insurance margin/cost
- Revenue expansion should prioritize B2B contracts, Worker Pro, boosted listings, insurance margin, and certification fees before extracting unfair fees from workers.
