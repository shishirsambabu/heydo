# 01 — Tech Stack Decision

> The locked stack for Heydo. Recorded as [memory/0003](../../.claude/memory/0003-phase-0-stack-decision.md).
> Vendors are working assumptions behind swappable abstractions ([integration_genius](../../.claude/geniuses/platform/integration_genius.md)); final selection follows commercial + security due diligence.

## Clients
| Surface | Choice | Why |
|---|---|---|
| Mobile app (Android + iOS) | **Flutter (Dart)** | One codebase, native performance on low-end Android, strong Malayalam text rendering, fast iteration. |
| Admin / Ops panel | **React + Next.js + TypeScript** | Data-dense ops UI, great tables/dashboards, shares TypeScript types with the backend. |

## Backend
| Concern | Choice | Why |
|---|---|---|
| Language/Framework | **Node.js + TypeScript + NestJS** | Shared types with the web admin, large India hiring pool, fast, first-class for API + event-driven modules. |
| Architecture | **Modular monolith → event-driven services** | Speed now, clean split later via the event backbone. |
| API style | **REST + JSON, versioned**; OpenAPI spec | Simple, mobile-friendly, easy for partners. (GraphQL not needed yet.) |

## Data & infrastructure
| Concern | Choice | Why |
|---|---|---|
| System of record + **ledger** | **PostgreSQL (AWS RDS)** | ACID, strong constraints, perfect for the double-entry ledger and trust graph. |
| Cache / queues / rate-limit | **Redis (AWS ElastiCache)** | Hot reads, job queues, idempotency dedup. |
| Event bus | **AWS SNS + SQS** (Kafka/MSK if volume demands) | Durable, ordered-enough, managed; drives Score/notifications/analytics. |
| Media (photos, VKYC artifacts) | **AWS S3** + KMS encryption | Cheap, durable; VKYC media in the isolated PII bucket. |
| Secrets / keys | **AWS Secrets Manager + KMS** | No secrets in code or logs. |
| Search/geo (later) | PostGIS first; OpenSearch if needed | Geo-matching of gigs↔workers. |
| Cloud | **AWS, `ap-south-1` (Mumbai)** primary, `ap-south-2` (Hyderabad) DR | India data residency for PII + money. |
| IaC | **Terraform** | Reproducible infra; no snowflakes ([infrastructure_genius](../../.claude/geniuses/reliability/infrastructure_genius.md)). |
| Containers | **Docker + ECS/Fargate** (EKS if needed) | Simple to run; scale later. |
| CI/CD | **GitHub Actions** | Build/test/deploy with staged rollouts + rollback. |
| Observability | **OpenTelemetry → CloudWatch / Grafana** | Traces/metrics/logs on the trust rail; **no PII in logs**. |

## Regulated vendors (working assumptions, swappable)
| Need | Target partners | Notes |
|---|---|---|
| **Live VKYC / Aadhaar** | **Signzy · HyperVerge · IDfy** | Licensed; liveness + Aadhaar + face match. Store **tokens/results**, not raw Aadhaar. |
| **Escrow / collection** | **Razorpay Route · Cashfree Easy-Split** | RBI-compliant escrow/split; holds funds until release. |
| **Payouts** | **RazorpayX · Cashfree Payouts** | UPI/bank disbursal of the 85%. |
| **Micro-insurance** | **Digit · ACKO · BIMA** | Per-gig accident cover via licensed insurer (IRDAI). |
| **WhatsApp** | **Meta WhatsApp Business Platform** (via Gupshup/AiSensy BSP) | Inbound gig posting + localized notifications. |
| **Push** | **FCM (Android) + APNs (iOS)** | Notifications. |
| **Wallet + RuPay card** (Phase 9) | Licensed **PPI** partner + RuPay network | Triggers PPI/KYC regulations; partner-issued. |
| **SMS/OTP** | MSG91 / AWS SNS | Phone auth. |

## Explicitly deferred (not in the early stack)
- Microservices split, Kafka, OpenSearch, ML fraud models, the wallet/card rails — added when scale/need justifies. Avoid premature complexity ([simplification_genius](../../.claude/geniuses/product/simplification_genius.md)).

## Open items to close before Phase 1 build
1. Pick the **primary VKYC vendor** (run a sandbox bake-off on liveness accuracy + Malayalam UX + price).
2. Pick the **escrow/payout provider** (escrow mechanics + payout reliability + KYC fit).
3. Confirm **insurance partner** sandbox availability.
4. Stand up the AWS org + India regions + Terraform baseline.
