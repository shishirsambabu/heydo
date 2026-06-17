# 0009 — Optional Postgres persistence path
- Date: 2026-06-17
- Phase: 1
- Decider: Platform Architect + Data Sovereign + Trust Architect
- Status: accepted

## Decision
Add optional Postgres-backed repositories behind `PERSISTENCE=postgres` while keeping `PERSISTENCE=memory` as the local default.

## Why
Didit can create hosted verification sessions, but the current in-memory backend loses session records on restart. Phase 1 needs durable identity, consent, and verification records so a Didit result or callback can be ingested after the worker completes the hosted flow.

## Implementation
- Added lazy `PgService` backed by `pg`.
- Added Postgres repositories for user, worker profile, giver profile, verification, and consent records.
- Modules choose memory vs Postgres repositories from env.
- `.env.example` now documents `PERSISTENCE`, `DATABASE_URL`, and `DATABASE_SSL`.
- Local/dev remains memory by default so tests and simple demos stay frictionless.

## Remaining Gate Work
- Provision AWS RDS Postgres and apply `apps/backend/prisma/schema.prisma`.
- Run the Didit smoke flow with `PERSISTENCE=postgres`.
- Add signed Didit webhook ingestion once callback URLs are stable.
- Add CI coverage for Postgres repositories using an ephemeral test database.
