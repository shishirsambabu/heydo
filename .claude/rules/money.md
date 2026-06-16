# RULE — Money is sacred

> Hard constraints for anything touching payments, escrow, payouts, or the wallet.
> Owner: [Trust Architect](../sovereigns/TRUST_ARCHITECT.md) + [Security Sentinel](../sovereigns/SECURITY_SENTINEL.md) + [Data Sovereign](../sovereigns/DATA_SOVEREIGN.md).
> Violating any of these blocks the phase gate.

1. **Double-entry, append-only ledger.** Every money movement is recorded as balanced entries. Never mutate or delete a ledger row; correct with new entries.
2. **Idempotency everywhere.** Every payment/escrow/payout operation is idempotent and retry-safe. A double-tap or network retry must never double-charge, double-pay, or double-release.
3. **Escrow correctness.** Funds lock on gig acceptance and release **only** on confirmed completion (or per the dispute/auto-release policy). No path releases escrow without an authorized trigger.
4. **The 85/15 split is exact.** Worker gets 85%, platform 15% — computed to the rupee/paisa with defined rounding. No silent erosion of the worker's 85%.
5. **Reconciliation to the rupee.** Platform balances, partner balances, and the ledger must reconcile. A discrepancy is a Sev-1 incident.
6. **No money action without authorization + audit.** Every movement is authenticated, authorized (least-privilege), and logged with who/what/when/why.
7. **Refunds & cancellations are modeled explicitly.** Every cancellation/refund/dispute outcome has defined money rules and ledger entries.
8. **Compliant rails only.** Collect, hold, and disburse via RBI-compliant partners (see [context/regulatory.md](../context/regulatory.md)). Heydo does not hold funds outside a compliant structure.
9. **Tested adversarially.** Money paths ship only after concurrency, retry, and partial-failure tests (Quality Overlord) and red-team review (Security Sentinel).
10. **No secrets or full card/account data in logs.**

> If you are unsure whether a change is money-safe, stop and pull in the Trust Architect.
