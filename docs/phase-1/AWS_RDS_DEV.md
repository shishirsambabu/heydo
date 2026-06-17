# AWS RDS Dev Database

Phase 1 needs durable Postgres so Didit VKYC sessions and results survive backend restarts.

## Recommended Free-Tier Setup

- Region: `ap-south-1` Mumbai, or `ap-south-2` Hyderabad if available.
- Engine: PostgreSQL.
- Template: Free tier.
- DB identifier: `heydo-dev`.
- Database name: `heydo`.
- Public access: **No** if you can connect through a secure network path. For quick local smoke tests only, temporary public access may be used with your IP allowlisted, then closed again.
- Storage encryption: On.
- Backups: On for dev, even if short retention.
- Master password: generated and stored outside Git.

## Local Env

Put this in repo-root `.env.local` or `apps/backend/.env.local`:

```env
PERSISTENCE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/heydo
DATABASE_SSL=true
DATABASE_SSL_CA_FILE=D:\heydo\.aws-rds-global-bundle.pem
```

Never commit `.env.local`.

## Apply Schema

```powershell
npm run db:schema:apply
```

If Node reports a self-signed certificate chain, download Amazon's RDS CA bundle:

```powershell
Invoke-WebRequest https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -OutFile D:\heydo\.aws-rds-global-bundle.pem
```

Then rerun the Didit smoke in durable mode:

```powershell
node scripts/didit-smoke.mjs start
```

Complete the hosted Didit flow, then ingest the result:

```powershell
node scripts/didit-smoke.mjs result
```

## Gate Notes

- No raw Aadhaar number, document image, selfie, or VKYC media is stored in Postgres.
- The backend stores Didit session references and decision signals only.
- RDS security group rules must be narrowed before any real user data enters the system.
