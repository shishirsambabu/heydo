# 04 — Repo Structure, Environments & CI

> How the code will be organized. Owned by the [Platform Architect](../../.claude/sovereigns/PLATFORM_ARCHITECT.md) +
> [Reliability Commander](../../.claude/sovereigns/RELIABILITY_COMMANDER.md). Decided now; scaffolded at the start of Phase 1.

## Monorepo layout (proposed)
A single repo with three deployable surfaces + shared packages (pnpm/turbo workspaces for the TS sides; Flutter app alongside).

```
heydo/
├── apps/
│   ├── mobile/            # Flutter app (Android + iOS) — workers & givers
│   ├── admin-web/         # Next.js + TS — admin / ops panel
│   └── backend/           # NestJS + TS — API + event-driven services
│       └── src/modules/
│           ├── identity/        # auth, profiles, VKYC, consent
│           ├── marketplace/     # gigs, categories, applications, selection
│           ├── payments/        # ledger, escrow, payouts, refunds
│           ├── reputation/      # score, ratings, badges, disputes
│           ├── notifications/   # push, in-app, WhatsApp
│           └── admin/           # ops endpoints (RBAC-gated)
├── packages/
│   ├── shared-types/      # TS types shared by backend + admin-web (incl. API DTOs)
│   ├── ledger/            # double-entry ledger primitives (heavily tested)
│   └── vendor-adapters/   # wrappers: vkyc/, escrow/, payouts/, insurance/, whatsapp/
├── infra/                 # Terraform (AWS) — RDS, Redis, S3, SNS/SQS, KMS, ECS
├── docs/                  # phase blueprints (this folder), ADRs, runbooks
├── .claude/               # the civilization (sovereigns, geniuses, rules, context, memory)
├── CLAUDE.md · HEYDO_OPERATING_SYSTEM.md · HEYDO_CIVILIZATION.md
```

> The Flutter app has its own Dart toolchain; `shared-types` serves the TS surfaces. A future `openapi` contract keeps the mobile client in sync with the backend.

## Environments
| Env | Purpose | Data |
|---|---|---|
| **local** | dev machines | seed/fake data, vendor sandboxes |
| **dev** | integration | synthetic data, vendor sandboxes |
| **staging** | pre-prod, QA, demos | realistic but synthetic; **no real PII** |
| **prod** | live (Kerala pilot) | real data, India region, full controls |

- Each env is **Terraform-provisioned** (no manual changes). PII/money tiers isolated.

## CI/CD skeleton (GitHub Actions)
- **On PR:** lint → typecheck → unit tests → **ledger/money + identity suites** (must pass) → build.
- **No merge on red.** Money/identity code cannot merge without its adversarial tests green ([automation_genius](../../.claude/geniuses/quality/automation_genius.md)).
- **On main:** build artifacts → deploy to dev → (manual approve) staging → (manual approve) **staged** prod rollout with one-command rollback.
- Mobile: build signed Android/iOS artifacts; staged store rollouts in Phase 8.
- Secrets via AWS Secrets Manager; **never** in the repo or logs.

## Branching & quality gates
- Trunk-based with short-lived feature branches; PR review required.
- Every fixed money/identity bug gets a regression test ([regression_genius](../../.claude/geniuses/quality/regression_genius.md)).
- ADRs (Architecture Decision Records) live in `docs/adr/` for notable choices.

## Phase 1 scaffolding tasks (when we start building)
1. Init monorepo + workspaces + Flutter app + NestJS app + Next.js admin.
2. Terraform baseline: VPC, RDS Postgres, Redis, S3 (incl. isolated PII bucket), KMS, SNS/SQS.
3. CI pipeline with the money/identity test gates wired.
4. Auth (phone/OTP) + the `identity` module skeleton + PII vault boundary.
