# Admin Safety Runbook

This runbook is for Heydo operators handling high-trust admin actions before Phase 2:
admin sessions, step-up verification, audit health, safety reports, evidence refs,
and lawful escalation packages.

Principle: if we cannot prove who did what, we do not do the action.

## Required Access

All calls require an admin JWT from:

```http
POST /admin/auth/dev-login
```

Production replacement: SSO plus mandatory MFA. The dev login is disabled in production.

Role rules:

| Action | Roles |
|---|---|
| View admin sessions | `super_admin` |
| Revoke admin session | `super_admin` |
| Force admin step-up | `super_admin` |
| Restore degraded audit health | `super_admin` plus second-admin maker-checker |
| View money trail | `finance`, `dispute_officer`, `super_admin` |
| View evidence refs | `fraud_analyst`, `dispute_officer`, `super_admin` |
| Review safety reports | `fraud_analyst`, `dispute_officer`, `super_admin` |
| Resolve safety disputes | `dispute_officer`, `super_admin` |
| Generate escalation package | `fraud_analyst`, `dispute_officer`, `super_admin` |

## Non-Negotiable Guardrails

- Never paste Aadhaar numbers, selfie images, raw VKYC media, bank details, or private evidence into notes.
- Use reason codes and concise notes. Evidence stays as vault refs.
- Sensitive actions require a fresh admin session.
- If audit health is degraded, sensitive actions fail closed with `audit_degraded`.
- For escalation/dispute flows, the same reviewer cannot be the only high-risk approver.
- For audit recovery, the investigator and restorer must be two different super admins.

## Admin Session Monitoring

Use this before revoking or forcing step-up:

```http
GET /admin/auth/sessions?limit=100
Authorization: Bearer ADMIN_TOKEN
```

Response includes:

```json
{
  "sessions": [
    {
      "id": "adm_sess_...",
      "adminId": "admin_1",
      "deviceId": "dev:admin_1",
      "status": "active",
      "mfaVerifiedAt": "2026-06-19T03:00:00.000Z",
      "expiresAt": "2026-06-26T03:00:00.000Z"
    }
  ],
  "summary": {
    "active": 1,
    "step_up_required": 0,
    "revoked": 0,
    "expired": 0
  }
}
```

Allowed statuses: `active`, `step_up_required`, `revoked`, `expired`.

The session list read is audited. If audit is degraded, it is blocked.

## Force Step-Up

Use this when an admin session looks suspicious but you do not yet need to revoke it:

```http
POST /admin/auth/sessions/adm_sess_TARGET/require-step-up
Authorization: Bearer SUPER_ADMIN_TOKEN
Content-Type: application/json

{
  "reason": "Suspicious evidence access pattern after support escalation."
}
```

Effect:

- The target admin can stay signed in.
- Sensitive actions fail with `admin_step_up_required`.
- The action is audited as `admin.session_step_up_required`.

Dev-only completion for local testing:

```http
POST /admin/auth/sessions/current/dev-step-up
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "secret": "dev-admin-secret"
}
```

Production replacement: real SSO/MFA step-up.

## Revoke A Suspicious Session

Use when the session is clearly compromised or an admin should lose access immediately:

```http
POST /admin/auth/sessions/adm_sess_TARGET/revoke
Authorization: Bearer SUPER_ADMIN_TOKEN
Content-Type: application/json

{
  "reason": "Confirmed account compromise from incident INC-104."
}
```

Notes:

- You cannot revoke your current session through this suspicious-session endpoint.
- Revoked sessions fail sensitive checks with `admin_session_revoked`.
- The action is audited as `admin.session_revoked`.

## Audit Health

Check audit health:

```http
GET /admin/marketplace/audit-health
Authorization: Bearer SUPER_ADMIN_TOKEN
```

Healthy:

```json
{
  "status": "ok",
  "failedWriteCount": 0,
  "recentFailures": []
}
```

Degraded:

```json
{
  "status": "degraded",
  "failedWriteCount": 1,
  "recentFailures": [
    {
      "action": "safety.dispute_refund_giver",
      "targetType": "safety_report",
      "targetId": "safe_1",
      "error": "database unavailable"
    }
  ]
}
```

When degraded, the backend blocks sensitive admin actions before state changes.

Blocked actions include:

- Money trail reads
- Evidence refs reads
- Gig approve/reject/flag
- Safety review
- Dispute resolution
- Escalation package generation/retrieval
- Admin session monitoring/revocation/step-up

## Restore Audit Health

Use only after the audit write path has been investigated and fixed.

Maker-checker rule:

- `investigatedByAdminId` must be the super admin who investigated/remediated the issue.
- The restoring admin must be a different super admin.
- Same-person restore is rejected with `second_reviewer_required`.

```http
POST /admin/marketplace/audit-health/restore
Authorization: Bearer DIFFERENT_SUPER_ADMIN_TOKEN
Content-Type: application/json

{
  "reason": "Audit database write path restored and verified.",
  "remediationRef": "INC-104",
  "investigatedByAdminId": "super_admin_who_investigated"
}
```

The backend first writes `admin.audit_recovery_confirmed`.
Only after that write succeeds does it clear degraded audit state.

If the recovery write fails, recovery returns `audit_degraded` and sensitive actions stay blocked.

## Safety Evidence And Escalation

View evidence refs:

```http
GET /admin/marketplace/safety-reports/safe_1/evidence-refs
Authorization: Bearer TRUST_OPERATOR_TOKEN
```

Generate lawful escalation package:

```http
POST /admin/marketplace/safety-reports/safe_1/escalation-package
Authorization: Bearer TRUST_OPERATOR_TOKEN
Content-Type: application/json

{
  "reasonCode": "police_escalation_ready",
  "note": "Evidence refs, gig trail, and money trail are ready for lawful escalation."
}
```

Controls:

- Requires fresh admin session.
- Requires healthy audit.
- Requires structured reason.
- If the same admin reviewed the case, a second reviewer must generate the package.
- Package snapshots are tamper-evident.

## Quick Triage Matrix

| Symptom | Action |
|---|---|
| Admin sees `admin_step_up_required` | Complete step-up or have super admin verify session status. |
| Admin sees `admin_session_revoked` | Treat as revoked access; do not restore without security review. |
| Admin sees `audit_degraded` | Stop sensitive actions, investigate audit write failures, then use maker-checker restore. |
| Same admin gets `second_reviewer_required` | Assign a different authorized admin to perform the final high-risk action. |
| Didit webhook succeeds but status not changing | Check backend logs, Didit final decision state, and `GET /verification/status`; do not manually approve without audit. |

## Definition Of Done For An Incident

- Issue has a ticket/reference.
- Affected admin sessions reviewed.
- Suspicious sessions revoked or forced to step-up.
- Audit health is `ok`.
- Recovery audit record exists if audit was degraded.
- Safety/dispute actions resumed only after the above is true.
