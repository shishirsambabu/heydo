# 05 — RBAC & Audit Model

> Who can do what, and the unforgeable record of who did it. Owned by the [Security Sentinel](../../.claude/sovereigns/SECURITY_SENTINEL.md)
> ([authorization_genius](../../.claude/geniuses/security/authorization_genius.md)) + [Reliability Commander](../../.claude/sovereigns/RELIABILITY_COMMANDER.md).
> Applies across the app and especially the admin panel (a high-privilege attack target). Default = **deny**.

## App-side roles (end users)
| Role | Can | Cannot |
|---|---|---|
| **Worker (unverified)** | browse, build profile, start VKYC | apply to gigs, get paid |
| **Worker (verified)** | apply, work, get paid (85%), rate givers, build Score | see others' PII |
| **Giver** | post gigs, choose applicants, pay (escrow), confirm, rate workers | see worker PII beyond what's shown |

## Admin-side roles (Heydo staff) — least privilege
| Role | Permissions | PII access |
|---|---|---|
| **Verification Officer** | review/approve/reject VKYC; request re-verify | VKYC data — masked, purpose-limited, logged |
| **Dispute Officer** | view disputed gigs, evidence; resolve → escrow action | gig + party data for that dispute only |
| **Fraud Analyst** | risk dashboards, flag/deactivate, view anomaly signals | risk-relevant, minimized |
| **Finance/Ops** | view ledger, trigger/track payouts, refunds, reconcile | money identifiers — masked; no full bank data in UI |
| **Partnerships** | Kudumbashree cohorts, B2B contracts/accounts | onboarding data only |
| **Support** | user lookup, action history, help actions | minimal, masked |
| **Super Admin** | manage roles/permissions, view audit log | no routine PII; access logged + alerted |

> No single role both **moves money** and **manages who can move money** — separation of duties. Sensitive actions (large payouts, deactivations, role grants) require **step-up auth** and may need **two-person approval**.

## Permission model
- **RBAC** with fine-grained permissions (e.g. `vkyc.review`, `escrow.release`, `payout.trigger`, `user.deactivate`, `role.grant`).
- Permissions checked at the API gateway **and** in the service (defense in depth).
- Service-to-service calls use scoped credentials; only the `payments` service can write the ledger; only `identity` can read the PII vault.

## Audit logging (non-negotiable)
Every sensitive action writes an **append-only audit record**:
```
audit_log: id · actor_id · actor_role · action · target_type · target_id
           · before/after (no raw PII; references only) · ip · timestamp · request_id
```
- Covers all **money**, **PII access**, **verification decisions**, **deactivations**, and **role changes**.
- Audit log is **append-only**, tamper-evident, retained per policy, and **contains no raw PII** (references/tokens only).
- Alerts fire on suspicious patterns (mass PII reads, off-hours payouts, privilege escalation) → [monitoring_genius](../../.claude/geniuses/reliability/monitoring_genius.md).

## Authentication
- **End users:** phone + OTP, hardened against SIM-swap/brute force ([authentication_genius](../../.claude/geniuses/security/authentication_genius.md)); secure sessions + device binding.
- **Admin staff:** SSO + **mandatory MFA**, short sessions, step-up for sensitive actions, IP/allowlist where feasible.

## Hard rules
1. Default deny; grant the minimum permission.
2. Every PII/money action is authenticated, authorized, and **audited**.
3. Separation of duties on money and on permission management.
4. No raw PII in the audit log or any log.
5. The admin panel gets **money-grade** security review in Phase 7 (pen-test, red-team).
