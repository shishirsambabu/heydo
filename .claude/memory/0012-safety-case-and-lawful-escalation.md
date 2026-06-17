# 0012 — Safety Cases and Lawful Escalation

Date: 2026-06-17

## Decision

Heydo must support safety reports from both sides of the marketplace. Any participant can raise a safety case tied to a gig for sexual misconduct, drugs/illegal activity, violence/threats, unsafe location, harassment, fraud, off-platform payment, or other safety concerns.

High/critical reports and serious reasons automatically flag the gig and raise risk level. Admin reviewers can mark cases under review, action taken, escalated, or closed, and record a lawful escalation reference.

## Rationale

The marketplace cannot be safe if worker verification is strong but demand-side safety is weak. Verified workers need protection from predatory, criminal, or unsafe requests; givers also need protection from worker misconduct. Heydo must preserve evidence references and maintain an audit trail so the team can act quickly and, where appropriate, cooperate with lawful police processes.

## Data Handling

Safety reports store evidence vault references only. Raw chats, images, location proof, selfies, or documents should live in controlled evidence/PII storage with least-privilege access and retention rules.

## Next Work

Implement real giver KYC capture before production launch: selfie/liveness, coarse service address/location proof, and risk-triggered re-verification. Add mobile UI for report/unsafe flows and admin UI for safety cases.
