import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-deployment-readiness.mjs', import.meta.url));

test('passes durable production configuration without printing secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'heydo-deploy-'));
  const credentialPath = join(directory, 'firebase-service-account.json');
  const privateKey = '-----BEGIN PRIVATE KEY-----fake-test-material-----END PRIVATE KEY-----';
  try {
    writeFileSync(
      credentialPath,
      JSON.stringify({
        type: 'service_account',
        project_id: 'heydo-prod',
        client_email: 'firebase-adminsdk@heydo-prod.iam.gserviceaccount.com',
        private_key: privateKey,
      }),
    );

    const result = runReadiness({
      GOOGLE_APPLICATION_CREDENTIALS: credentialPath,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /readyForDurableBackend=true/);
    assert.match(result.stdout, /apiPublicHost=api\.heydo\.in/);
    assert.doesNotMatch(result.stdout, /postgresql:\/\/heydo/);
    assert.doesNotMatch(result.stdout, /jwt-secret-value/);
    assert.doesNotMatch(result.stdout, /fake-test-material/);
    assert.doesNotMatch(result.stdout, /firebase-adminsdk@/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fails closed for tunnel URLs, api CORS origin, and repo-local credentials', () => {
  const repoLocalDirectory = mkdtempSync(resolve('deploy-readiness-local-'));
  const repoLocalCredential = join(repoLocalDirectory, 'firebase-service-account.json');
  writeFileSync(
    repoLocalCredential,
    JSON.stringify({
      type: 'service_account',
      project_id: 'heydo-prod',
      client_email: 'firebase-adminsdk@heydo-prod.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----fake-test-material-----END PRIVATE KEY-----',
    }),
  );
  try {
    const result = runReadiness({
      API_PUBLIC_URL: 'https://temp.trycloudflare.com',
      CORS_ORIGINS: 'https://temp.trycloudflare.com',
      DIDIT_CALLBACK_URL: 'https://different.heydo.in/verification/callback',
      GOOGLE_APPLICATION_CREDENTIALS: repoLocalCredential,
    });

    assert.equal(result.status, 1);
    assert.match(result.stdout, /readyForDurableBackend=false/);
    assert.match(result.stdout, /apiPublicUrlLooksDurable/);
    assert.match(result.stdout, /firebaseCredentialsOutsideRepo/);
    assert.match(result.stdout, /diditCallbackUrlMatchesApiHost/);
    assert.match(result.stdout, /corsOriginsDoNotAllowApiHost/);
  } finally {
    rmSync(repoLocalDirectory, { recursive: true, force: true });
  }
});

test('reports invalid API URL instead of crashing', () => {
  const result = runReadiness({
    API_PUBLIC_URL: 'not a url',
    CORS_ORIGINS: 'https://admin.heydo.in',
    DIDIT_CALLBACK_URL: 'https://api.heydo.in/verification/callback',
    GOOGLE_APPLICATION_CREDENTIALS: '',
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /apiPublicHost=missing/);
  assert.match(result.stdout, /readyForDurableBackend=false/);
});

function runReadiness(overrides = {}) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    cwd: fileURLToPath(new URL('../../..', import.meta.url)),
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      API_PUBLIC_URL: 'https://api.heydo.in',
      CORS_ORIGINS: 'https://admin.heydo.in,https://heydo.in',
      PERSISTENCE: 'postgres',
      DATABASE_URL: 'postgresql://heydo:secret@db.example.com:5432/heydo',
      DATABASE_SSL: 'true',
      JWT_SECRET: 'jwt-secret-value-that-is-not-dev',
      PII_ENCRYPTION_KEY: 'pii-secret-value-that-is-not-dev',
      PUSH_TOKEN_ENCRYPTION_KEY: 'push-token-secret-value-that-is-not-dev',
      PUSH_PROVIDER: 'fcm',
      FIREBASE_PROJECT_ID: 'heydo-prod',
      GOOGLE_APPLICATION_CREDENTIALS: '',
      VKYC_PROVIDER: 'didit',
      DIDIT_API_KEY: 'didit-secret-key',
      DIDIT_WORKFLOW_ID: 'didit-worker-workflow',
      DIDIT_GIVER_WORKFLOW_ID: 'didit-giver-workflow',
      DIDIT_WEBHOOK_SECRET: 'didit-webhook-secret',
      DIDIT_CALLBACK_URL: 'https://api.heydo.in/verification/callback',
      ...overrides,
    },
  });
}
