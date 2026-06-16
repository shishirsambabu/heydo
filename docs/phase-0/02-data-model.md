# 02 — Trust-Graph Data Model (v0)

> The data that **is** the moat. Owned by the [Data Sovereign](../../.claude/sovereigns/DATA_SOVEREIGN.md) with the
> [Trust Architect](../../.claude/sovereigns/TRUST_ARCHITECT.md) (Score, escrow) and [Security Sentinel](../../.claude/sovereigns/SECURITY_SENTINEL.md) (PII).
> PostgreSQL. v0 = enough to build Phases 1–4; not every column is final.

## 1. Identity & profiles

**user** — the base account
- `id` (uuid, pk) · `phone` (unique, **PII**) · `roles` (worker|giver|both) · `locale` (default `ml`) · `status` (active|suspended|deleted) · `created_at`

**worker_profile**
- `user_id` (fk→user) · `display_name` · `bio_ml` / `bio_en` · `photo_url` · `skills` (jsonb) · `categories` (fk[]→category) · `service_area` (PostGIS geography, **PII-ish**) · `verification_status` (unverified|pending|approved|rejected|expired) · `heydo_score` (derived, denormalized) · `pro_subscription` (bool) · `created_at`

**giver_profile**
- `user_id` (fk→user) · `display_name` · `default_location` (geo) · `rating_as_giver` (derived) · `status` (active|deactivated_abusive) · `created_at`

**verification** — VKYC result (NOT raw Aadhaar)
- `id` · `user_id` · `vendor` (signzy|hyperverge|idfy) · `vendor_ref` · `status` (pending|approved|rejected|expired) · `liveness_passed` (bool) · `aadhaar_match` (bool) · `aadhaar_token` (**PII, vault ref only**) · `face_match_score` · `media_ref` (**PII, S3 vault**) · `reviewed_by` (fk→admin_user, nullable) · `verified_at` · `expires_at`

**consent** — DPDP lawful basis
- `id` · `user_id` · `purpose` (vkyc|payments|notifications|...) · `policy_version` · `granted_at` · `revoked_at` (nullable)

## 2. Marketplace

**category**
- `id` · `name_ml` · `name_en` · `group` (home_services|creative|lifestyle|events|...) · `active` (bool)

**gig**
- `id` · `giver_id` (fk→user) · `category_id` · `title` · `description` · `location` (geo, **PII-ish**) · `scheduled_at` · `budget_amount` (int, paisa) · `currency` (INR) · `status` (draft|posted|assigned|in_progress|completed|cancelled|disputed) · `bundle_parent_id` (nullable, for event bundles) · `created_at`

**application** — a worker applies (the applicant model)
- `id` · `gig_id` · `worker_id` · `message_ml` · `proposed_price` (nullable) · `status` (applied|withdrawn|selected|rejected) · `created_at`
- *Constraint:* a worker can apply only if `verification_status = approved`.

**assignment** — the giver chooses
- `id` · `gig_id` (unique) · `worker_id` · `application_id` · `selected_at`

## 3. Reputation

**rating** — dual-side, directional
- `id` · `gig_id` · `rater_id` · `ratee_id` · `direction` (giver_to_worker|worker_to_giver) · `stars` (1–5) · `tags` (jsonb) · `comment` · `created_at`
- *Constraint:* one rating per direction per completed gig; no rating without a completed gig.

**heydo_score** — derived & reproducible
- `worker_id` (pk) · `score` · `avg_rating` · `on_time_rate` · `completion_rate` · `gigs_completed` · `recomputed_at`
- Computed from events; stored for fast reads. Always reproducible from the event log.

**badge**
- `id` · `worker_id` · `type` (master_plumber|top_rated_painter|...) · `level` · `earned_at`

**dispute**
- `id` · `gig_id` · `raised_by` (fk→user) · `reason` · `status` (open|under_review|resolved) · `resolution` · `escrow_action` (release_to_worker|refund_to_giver|split) · `resolved_by` (fk→admin_user) · `created_at` · `resolved_at`

**insurance_policy**
- `id` · `gig_id` · `worker_id` · `partner` (digit|acko|bima) · `policy_ref` · `status` (active|expired|claimed) · `activated_at`

## 4. Money — double-entry, append-only ledger

> The heart of "money is sacred." Sum of debits = sum of credits for every transaction. **Never mutate or delete.** ([rules/money.md](../../.claude/rules/money.md))

**account** — every party that can hold/move value
- `id` · `owner_type` (platform|giver|worker|escrow|partner) · `owner_id` · `type` (cash|escrow|payable|revenue) · `currency`

**ledger_transaction** — a balanced group of postings
- `id` · `type` (escrow_lock|escrow_release|payout|refund|commission|insurance_premium|adjustment) · `gig_id` (nullable) · `idempotency_key` (unique) · `status` (pending|posted|failed) · `created_at`

**ledger_posting** — the balanced legs
- `id` · `transaction_id` (fk) · `account_id` (fk) · `direction` (debit|credit) · `amount` (int, paisa) · `currency`
- *Invariant:* `SUM(debit) = SUM(credit)` per `transaction_id`.

**escrow_hold**
- `id` · `gig_id` (unique) · `amount` (paisa) · `status` (held|released|refunded) · `provider_ref` · `created_at`

**payout**
- `id` · `worker_id` · `gig_id` · `amount` (paisa, = 85% of gig) · `status` (initiated|completed|failed) · `provider_ref` · `idempotency_key` (unique) · `created_at`

### Worked example — a ₹1,000 gig completes
```
escrow_lock      : debit giver_cash 1000 | credit escrow 1000
escrow_release   : debit escrow 1000     | credit worker_payable 850, credit platform_revenue 150
payout (85%)     : debit worker_payable 850 | credit worker_cash 850
```
85% (₹850) to worker, 15% (₹150) to platform — to the paisa, idempotent, fully auditable.

## 5. Domain events (the event backbone)
`verification.submitted` · `verification.approved` · `verification.rejected`
`gig.posted` · `gig.application_submitted` · `gig.worker_selected` · `gig.started` · `gig.completed` · `gig.cancelled`
`escrow.locked` · `escrow.released` · `escrow.refunded` · `payout.initiated` · `payout.completed`
`rating.submitted` · `score.recomputed` · `badge.earned`
`dispute.opened` · `dispute.resolved` · `insurance.activated`

> The Score, notifications, analytics, and the admin panel are all **consumers** of these events. Events are durable and replayable → the Score and audit trail can always be rebuilt.

## 6. PII classification (drives encryption, access, retention)
| Class | Fields | Handling |
|---|---|---|
| **Critical** | `aadhaar_token`, VKYC `media_ref`, face data | PII vault only; KMS-encrypted; access logged; never in logs/analytics; strict retention + deletion |
| **High** | `phone`, full address, precise `location`, bank/UPI refs | Encrypted; masked by default in admin; least-privilege |
| **Medium** | `display_name`, `photo_url`, coarse service area | Standard protection |
| **Public-in-product** | `heydo_score`, ratings, badges, category, `name_*` | Shown in app; still access-controlled writes |

Every Critical/High field has a **retention period + deletion path** ([data_governance_genius](../../.claude/geniuses/data/data_governance_genius.md)) and is covered by [rules/pii_and_privacy.md](../../.claude/rules/pii_and_privacy.md).

## 7. Integrity rules (enforced in DB + service layer)
1. No `application` unless worker `verification_status = approved`.
2. No `rating` without a `completed` gig; one per direction.
3. `escrow_hold` exists before a gig is `assigned`; released only on `completed` or dispute resolution.
4. Ledger postings always balance; ledger rows are append-only.
5. `payout.amount = round(gig.budget_amount * 0.85)` with defined rounding; platform takes the remainder.
6. Every money transaction carries a unique `idempotency_key`.
