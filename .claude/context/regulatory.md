# Context — Regulatory & Compliance

> The legal/regulatory reality Heydo operates in. Not legal advice — engage counsel before launch.
> Treat this as constraints the build must respect.

## Identity / Aadhaar / VKYC
- VKYC and Aadhaar-based verification are regulated. Use a **licensed/authorized VKYC vendor**; do not build Aadhaar auth in-house.
- Store the **minimum** identity data needed; prefer verification tokens/results over raw Aadhaar numbers where possible.
- Explicit, informed **consent** before any verification; clear purpose limitation.

## Data protection (India DPDP Act, 2023)
- Lawful consent, purpose limitation, data minimization, storage limitation.
- Honor data-subject rights (access, correction, erasure) where applicable.
- Breach notification obligations — have an incident plan (Reliability Commander).
- See [rules/pii_and_privacy.md](../rules/pii_and_privacy.md) for the hard rules.

## Payments / escrow / money
- Use an **RBI-compliant** payment partner; route escrow through a compliant nodal/escrow mechanism. Heydo does not hold customer funds outside a compliant structure.
- Wallet / prepaid instrument / RuPay card (Phase 9) triggers **PPI and KYC** regulations — partner with a licensed issuer.
- Maintain auditable, reconcilable money records (Data Sovereign).

## Insurance
- Per-gig micro-insurance must be distributed via a **licensed insurer/partner** (e.g., BIMA/Digit) under IRDAI rules.

## Labour / gig-worker
- Track evolving gig-worker / social-security regulations (Code on Social Security); the worker-protection features align well with this direction.

## Government partnership
- Kudumbashree / Kerala-government tie-ups follow public-partnership norms; budget for due diligence and procurement processes.

> Rule of thumb: anything touching Aadhaar, money, or insurance goes through a licensed partner and a compliance review before it ships.
