-- Heydo Postgres schema.
-- Phase 1 needs durable identity, consent, and verification records for Didit
-- callbacks/results. Later phase tables are included so the trust graph grows
-- without a destructive reset.
--
-- PII rule: store verification signals and opaque references only. No raw
-- Aadhaar number, document image, selfie, or VKYC media bytes belong here.

CREATE TABLE IF NOT EXISTS "User" (
  id text PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  roles text[] NOT NULL DEFAULT '{}',
  locale text NOT NULL DEFAULT 'ml',
  status text NOT NULL DEFAULT 'active',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "User_status_check" CHECK (status IN ('active', 'suspended', 'deleted'))
);

CREATE TABLE IF NOT EXISTS "WorkerProfile" (
  "userId" text PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  "displayName" text NOT NULL,
  "bioMl" text,
  "bioEn" text,
  "photoUrl" text,
  skills text[] NOT NULL DEFAULT '{}',
  "categoryIds" text[] NOT NULL DEFAULT '{}',
  "serviceAreaLabel" text,
  "verificationStatus" text NOT NULL DEFAULT 'unverified',
  "heydoScore" double precision,
  "proSubscription" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "WorkerProfile_verificationStatus_check"
    CHECK ("verificationStatus" IN ('unverified', 'pending', 'approved', 'rejected', 'expired'))
);

CREATE TABLE IF NOT EXISTS "GiverProfile" (
  "userId" text PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  "displayName" text NOT NULL,
  "defaultLocation" text,
  "ratingAsGiver" double precision,
  status text NOT NULL DEFAULT 'active',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "GiverProfile_status_check" CHECK (status IN ('active', 'deactivated_abusive'))
);

CREATE TABLE IF NOT EXISTS "Verification" (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  vendor text NOT NULL,
  "sessionId" text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  "livenessPassed" boolean,
  "aadhaarMatch" boolean,
  "faceMatchScore" double precision,
  "vendorResultAt" timestamptz,
  "aadhaarVaultRef" text,
  "mediaVaultRef" text,
  "reviewedBy" text,
  "decisionReason" text,
  "decisionAt" timestamptz,
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Verification_status_check"
    CHECK (status IN ('unverified', 'pending', 'approved', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS "Verification_status_vendorResultAt_idx"
  ON "Verification"(status, "vendorResultAt");
CREATE INDEX IF NOT EXISTS "Verification_userId_idx"
  ON "Verification"("userId");

CREATE TABLE IF NOT EXISTS "Consent" (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  "policyVersion" text NOT NULL,
  "grantedAt" timestamptz NOT NULL DEFAULT now(),
  "revokedAt" timestamptz
);

CREATE INDEX IF NOT EXISTS "Consent_userId_purpose_idx"
  ON "Consent"("userId", purpose);

CREATE TABLE IF NOT EXISTS "Category" (
  id text PRIMARY KEY,
  "nameMl" text NOT NULL,
  "nameEn" text NOT NULL,
  "group" text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "Gig" (
  id text PRIMARY KEY,
  "giverId" text NOT NULL,
  "categoryId" text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  "scheduledAt" timestamptz NOT NULL,
  "budgetAmount" integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'posted',
  "bundleParentId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Gig_status_idx" ON "Gig"(status);
CREATE INDEX IF NOT EXISTS "Gig_categoryId_idx" ON "Gig"("categoryId");

CREATE TABLE IF NOT EXISTS "Application" (
  id text PRIMARY KEY,
  "gigId" text NOT NULL REFERENCES "Gig"(id) ON DELETE CASCADE,
  "workerId" text NOT NULL,
  "messageMl" text,
  "proposedPrice" integer,
  status text NOT NULL DEFAULT 'applied',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Application_gigId_workerId_key" UNIQUE ("gigId", "workerId")
);

CREATE TABLE IF NOT EXISTS "Assignment" (
  id text PRIMARY KEY,
  "gigId" text NOT NULL UNIQUE,
  "workerId" text NOT NULL,
  "applicationId" text NOT NULL,
  "selectedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Rating" (
  id text PRIMARY KEY,
  "gigId" text NOT NULL,
  "raterId" text NOT NULL,
  "rateeId" text NOT NULL,
  direction text NOT NULL,
  stars integer NOT NULL,
  tags jsonb,
  comment text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Rating_gigId_direction_key" UNIQUE ("gigId", direction),
  CONSTRAINT "Rating_stars_check" CHECK (stars BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS "Badge" (
  id text PRIMARY KEY,
  "workerId" text NOT NULL,
  type text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  "earnedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Dispute" (
  id text PRIMARY KEY,
  "gigId" text NOT NULL,
  "raisedBy" text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  "escrowAction" text,
  "resolvedBy" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "resolvedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS "Account" (
  id text PRIMARY KEY,
  "ownerType" text NOT NULL,
  "ownerId" text NOT NULL,
  type text NOT NULL,
  currency text NOT NULL DEFAULT 'INR'
);

CREATE INDEX IF NOT EXISTS "Account_ownerType_ownerId_idx"
  ON "Account"("ownerType", "ownerId");

CREATE TABLE IF NOT EXISTS "LedgerTransaction" (
  id text PRIMARY KEY,
  type text NOT NULL,
  "gigId" text,
  "idempotencyKey" text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'posted',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "LedgerPosting" (
  id text PRIMARY KEY,
  "transactionId" text NOT NULL REFERENCES "LedgerTransaction"(id),
  "accountId" text NOT NULL REFERENCES "Account"(id),
  direction text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  CONSTRAINT "LedgerPosting_direction_check" CHECK (direction IN ('debit', 'credit')),
  CONSTRAINT "LedgerPosting_amount_check" CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS "LedgerPosting_transactionId_idx"
  ON "LedgerPosting"("transactionId");
CREATE INDEX IF NOT EXISTS "LedgerPosting_accountId_idx"
  ON "LedgerPosting"("accountId");

CREATE TABLE IF NOT EXISTS "EscrowHold" (
  id text PRIMARY KEY,
  "gigId" text NOT NULL UNIQUE,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'held',
  "providerRef" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "EscrowHold_amount_check" CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS "Payout" (
  id text PRIMARY KEY,
  "workerId" text NOT NULL,
  "gigId" text NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'initiated',
  "providerRef" text,
  "idempotencyKey" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Payout_amount_check" CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id text PRIMARY KEY,
  "actorId" text NOT NULL,
  "actorRole" text NOT NULL,
  action text NOT NULL,
  "targetType" text NOT NULL,
  "targetId" text NOT NULL,
  metadata jsonb,
  ip text,
  "requestId" text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx"
  ON "AuditLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx"
  ON "AuditLog"("actorId");
