# RULE — PII is radioactive

> Hard constraints for handling personal data, especially Aadhaar/VKYC.
> Owner: [Security Sentinel](../sovereigns/SECURITY_SENTINEL.md) + [Data Sovereign](../sovereigns/DATA_SOVEREIGN.md).
> Violating any of these blocks the phase gate. See also [context/regulatory.md](../context/regulatory.md).

1. **Minimize.** Collect only the PII a feature truly needs. Prefer verification **results/tokens** over raw Aadhaar numbers. You cannot leak what you never stored.
2. **Never log PII.** No Aadhaar, VKYC media, face data, full phone/address, or money identifiers in logs, traces, error messages, or analytics. Ever.
3. **Encrypt everywhere.** PII is encrypted at rest and in transit. The PII vault is isolated from general services.
4. **Least-privilege access.** Only the specific services/roles that must read PII can, and every access is logged and attributable.
5. **Lawful consent.** Explicit, informed, purpose-limited consent before verification or PII collection (DPDP Act). Consent is revocable.
6. **Retention limits.** Every PII field has a defined retention period and deletion path. Don't keep it "just in case."
7. **Honor data-subject rights.** Support access, correction, and erasure where applicable.
8. **Licensed vendors only** for Aadhaar/VKYC. No in-house Aadhaar handling.
9. **Privacy review before launch.** Every feature touching PII gets a privacy-by-design review (Privacy Genius) before it ships.
10. **Breach plan ready.** A detection + notification + response runbook exists (Reliability Commander) before any PII goes to production.

> One PII breach destroys the trust that is Heydo's entire reason to exist. When in doubt, collect less and ask the Security Sentinel.
