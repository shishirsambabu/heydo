# 0011 — Phase 2 Gig Safety Gate

Date: 2026-06-17

## Decision

Phase 2 marketplace work must protect both sides. A gig request is not worker-visible just because a giver posted it. It must pass a safety gate first:

- low-risk requests become `visible`
- suspicious requests become `pending_review`
- clearly unsafe/exploitative requests become `rejected`
- admins can approve, reject, or flag gigs through the marketplace moderation queue

Workers may browse/apply only to `visible` gigs.

## Rationale

Heydo's trust promise is dual-sided. VKYC protects givers from unknown workers, but verified workers also need protection from unsafe homes, exploitative requests, illegal work, off-platform payment pressure, and isolating situations. Sending verified workers into unmoderated demand would weaken the trust rail.

## Implementation Notes

Backend gig records now carry `visibilityStatus`, `riskLevel`, `safetyFlags`, and moderation audit fields. The first screening rules are deterministic and conservative; later phases can replace or augment them with human review tooling, richer risk models, dual-side ratings, and safety incident history.
