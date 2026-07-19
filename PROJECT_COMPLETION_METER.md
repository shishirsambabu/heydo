# Heydo Project Completion Meter

Last updated: 2026-07-18

This meter is a practical launch-readiness tracker, not a vanity percentage. It moves only when code, configuration, tests, or operational gates are actually completed.

## Current Overall Meter

**Overall MVP launch readiness: 72%**

| Area | Progress | Status |
| --- | ---: | --- |
| Foundation, repo, architecture, AWS/RDS setup | 78% | Core decisions, RDS configuration, and latest schema application are in place; production deployment still pending. |
| Identity and VKYC trust loop | 86% | Didit webhook is integrated, signed callback persistence is covered by tests, readiness and redacted callback lookup are visible in admin, CLI readiness exists, worker/giver KYC gates exist, and live worker/giver Didit evidence has been recorded. |
| Marketplace core | 86% | Posting, applying, choosing, lifecycle, Malayalam launch categories, pricing guides, proposal tokens, durable in-app notifications, and the repeatable Phase 2 applicant smoke are built and passed locally; real-device mobile and push delivery QA remain. |
| Safety and abuse prevention | 88% | Safety reports, evidence refs, escalation packages, abusive-user actions, gig quarantine, low-rating triage, admin visibility, operator policy matrix, and the pre-Phase-2 evidence gate are built and exercised. |
| Admin / ops panel | 80% | Gig review, VKYC readiness, safety queues, economics, token grants, audit trails, phase-gate evidence, decision context, project meter, and operator policy matrix are present; RBAC hardening still needs final pass. |
| Money, escrow, payouts | 22% | 85/15 economics are modeled; real escrow, payment collection, payout, refund, and reconciliation are not production-ready yet. |
| Mobile app readiness | 91% | Main flows exist, backend applicant loop is proven, Flutter analyze and 15 tests pass, Android SDK/toolchain is doctor-green, and the app builds under permanent ID `in.heydo.app`. Firebase Messaging initializes only after authentication, registers and rotates tokens, tracks locale, refreshes the foreground inbox, and routes background/cold-start taps into one durable inbox; Firebase project provisioning and physical-device delivery proof remain. |
| Localization, accessibility, offline resilience | 46% | Malayalam network recovery guidance, bounded request timeouts, one safe GET retry, no automatic POST retries, and time-limited offline public marketplace reads are implemented and tested. Private/authenticated data and writes remain online-only; accessibility and physical low-connectivity QA remain. |
| Production deployment and monitoring | 32% | Domain and Cloudflare are configured, and `npm run deploy:readiness` defines the durable backend gate; backend is still using temporary/local tunnel for webhook testing. |
| Legal, compliance, ops policy | 34% | Safety and escalation rails exist; DPDP/privacy, police escalation SOP, insurance, and operating manuals need completion. |

## Current Gate

**Phase 2 applicant marketplace gate: 98%**

The pre-Phase-2 safety hardening evidence is complete. Phase 2 is now the active build phase: prove the applicant-model marketplace end to end on a real device, in Malayalam, with verified users.

Done:

- Worker and giver VKYC gates are represented in app/backend flows.
- Didit webhook path is working and accepted a test webhook with HTTP 201.
- Gigs can be held for admin approval before going live.
- Admin has marketplace review context, pricing guardrails, safety signals, and economics visibility.
- Safety reports can target giver or worker side and preserve escalation context.
- Abusive givers/workers can be deactivated or suspended from the admin safety console.
- Low ratings can feed safety review.
- Proposal tokens support counter-rate requests, balance checks, grants, and audit trails.
- The admin marketplace console now shows the launch-readiness meter and active gate blockers.
- The latest backend schema has been applied successfully to the configured Postgres database.
- Signed Didit callback persistence is covered by backend tests for worker pending-review flow, giver Didit approval flow, duplicate callbacks, unknown sessions, and tampered signatures.
- Admin now has an operator policy matrix for gig approval, safety review, account action, money disputes, and lawful escalation decisions.
- Kerala launch categories now have Malayalam labels and matching pricing guardrails, with backend tests preventing missing guides.
- Admin now has a secret-safe Didit readiness panel for provider mode, worker/giver workflows, webhook secret, persistence, and database configuration.
- `npm run vkyc:readiness` now provides the same secret-safe live Didit readiness check from the CLI.
- `npm run mobile:qa` now defines the Flutter analyze/test gate and fails clearly when Flutter is not installed.
- `npm run deploy:readiness` now defines the durable `api.heydo.in` backend gate and fails locally until production URL, CORS, production secrets, and Didit callback URL are configured.
- Admin can now look up redacted verification state by Didit session id or latest user role after live callbacks.
- Admin can now record, list, and compute status from auditable pre-Phase-2 gate evidence for live Didit workflows, callbacks, Flutter QA, and durable backend readiness.
- Admin can now formally close the pre-Phase-2 safety hardening gate, and the required live Didit workflow/callback evidence has been recorded.
- Required live evidence reached 4/4: worker Didit live, giver Didit live, approved callback persisted, and declined/non-approved callback persisted.
- `npm run phase2:smoke -- all` now defines the repeatable applicant-model smoke path for local/mock QA; with Didit it runs in `setup`, `ingest`, and `run` phases so KYC is never bypassed.
- Phase 2 smoke passed locally with one verified giver, three verified workers, three applications, one selected worker, completed lifecycle, proposal-token counter-rate spend, 15% platform fee math, and dual ratings.
- Mobile QA now has a Windows setup helper and `HEYDO_API_BASE` support for physical Android testing against a local PC or tunnel URL.
- `npm run mobile:qa` now passes with Flutter 3.44.4: dependency resolution, static analysis, and widget tests are clean.
- Android SDK/toolchain is installed on D: and `flutter doctor -v` reports no issues.
- Android 36 emulator QA now builds and installs the debug APK, launches against the local backend, renders Malayalam without visible overflow, requests a mock OTP, verifies it, and reaches the worker/giver role screen.
- The Windows Android build now disables incompatible cross-drive Kotlin incremental caching, preventing Pub-cache sources on C: from breaking builds rooted on D:.
- Mobile API requests now fail within a bounded timeout, retry safe reads once after transient network loss, and never automatically retry state-changing writes such as gig posts or applications.
- Malayalam and English offline/timeout recovery messages are wired into app state, with focused tests proving retry, timeout, and no-duplicate-write behavior.
- The hardened APK rebuilt and launched on the Android emulator in Malayalam, and the emulator survived airplane-mode disable/restore during QA.
- The Flutter marketplace now falls back to a 7-day cache for public categories/pricing rules and a 15-minute cache for visible gig cards and public giver scores when the network is unavailable.
- Offline cache writes use explicit field allowlists, discard unexpected identity/contact/internal fields, never cache token balances or authenticated/private records, and never queue marketplace writes.
- Push registration tokens are encrypted at rest, fingerprinted for deduplication, redacted from API responses, and revocable only by their authenticated owner.
- Push attempts now have a durable delivery audit trail; successful FCM sends, failures, and invalid-token deactivation are covered by backend tests.
- The backend implements the FCM HTTP v1 provider using short-lived Google credentials and remains truthfully `not_configured` until Firebase is enabled.
- Malayalam and English offline banners clearly state that saved information is being shown and actions still require internet; the full Flutter analyze/test gate passes.
- Flutter Firebase Messaging is wired behind an explicit build flag and starts only after Heydo authentication and notification consent.
- Initial and rotated FCM tokens register through the owner-scoped backend API without being logged or exposed; locale changes re-register the active token and foreground messages refresh the durable inbox.
- Android and iOS now use permanent application identity `in.heydo.app`; the Android debug APK builds successfully with Firebase disabled by default.
- Thirteen Flutter tests pass, including push token rotation, locale synchronization, foreground refresh, and proof that Firebase failure cannot block OTP login.
- `npm run firebase:readiness` now validates permanent app IDs, gitignored mobile client configuration, backend FCM mode, service-account shape/file presence, and three-way project-ID agreement without printing sensitive values.
- Background and terminated-state notification taps now refresh authoritative inbox state and open a single durable notification screen; duplicate opens cannot stack multiple inbox routes.
- Flutter analysis, 15 tests, and a fresh Android debug APK build pass with the notification-open lifecycle wired.

Still required before we call Phase 2 complete:

- Repeat the passed applicant-model loop through the Flutter app on a real Android device.
- Confirm Malayalam copy, input validation, and low-connectivity behavior across post/apply/choose/lifecycle/rating.
- Confirm admin can moderate categories/listings and see live marketplace health during a mobile-driven run.
- Run real-device Malayalam QA against the backend.
- Deploy the backend to a durable HTTPS URL, configure `API_PUBLIC_URL`, `CORS_ORIGINS`, production secrets, and update Didit from the temporary tunnel.
- Provision the Firebase project for `in.heydo.app`, configure backend credentials, and prove a lifecycle push on a physical Android device.

## Phase Position

| Phase | Completion | Notes |
| --- | ---: | --- |
| Phase 0 - Foundation & Blueprint | 80% | Mostly complete, but roadmap metadata needs updating and final decision records should be kept current. |
| Phase 1 - Identity Loop / VKYC | 72% | Built enough for integration testing; final gate needs real workflow validation and mobile/device QA. |
| Safety Hardening Before Phase 2 | 100% | Required live Didit worker/giver and callback evidence has been recorded; keep the close-gate audit decision in admin. |
| Phase 2 - Gig Posting, Applying, Choosing | 98% | Local applicant-model smoke passed, durable in-app and FCM push infrastructure including notification-tap routing is built, and Android Malayalam runtime plus network/cache behavior is proven; active gate is live Firebase provisioning and physical Android lifecycle/push/low-connectivity QA. |
| Phase 3 - Money / Escrow / Payouts | 22% | Modeled, not production-safe yet. This is the next major risk area after Phase 2. |
| Phases 4-9 | 10% | Mostly vision/spec level with some enabling groundwork. |

## How To Use This After Every Run

Every build run should end with:

1. What changed.
2. What was verified.
3. The updated meter.
4. The next gate.

Recommended final-response snippet:

```text
Project meter: Overall MVP launch readiness 72%; active gate, Phase 2 applicant marketplace 98%.
Next gate: provision Firebase for `in.heydo.app`, prove one lifecycle notification on a physical Android device, then run the complete applicant lifecycle in Malayalam while interrupting and restoring connectivity.
```

## Next Best Build Step

The next highest-leverage step is to provision Firebase for `in.heydo.app`, enable the authenticated mobile client with the documented Dart defines, and record a real physical-device delivery before the full Malayalam applicant run.
