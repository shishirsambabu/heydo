import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./firebase-readiness.mjs', import.meta.url));

test('passes matching configuration without printing credential values', () => {
  const directory = mkdtempSync(join(tmpdir(), 'heydo-firebase-'));
  const clientPath = join(directory, 'firebase.local.json');
  const credentialPath = join(directory, 'service-account.json');
  const apiKey = `AI${'za'}${'1'.repeat(35)}`;
  const clientEmail = 'firebase-adminsdk@example-project.iam.gserviceaccount.com';
  const privateKey = '-----BEGIN PRIVATE KEY-----fake-test-material-----END PRIVATE KEY-----';

  try {
    writeFileSync(
      clientPath,
      JSON.stringify({
        HEYDO_FIREBASE_ENABLED: true,
        HEYDO_FIREBASE_API_KEY: apiKey,
        HEYDO_FIREBASE_APP_ID: '1:123456789:android:abcdef1234567890',
        HEYDO_FIREBASE_MESSAGING_SENDER_ID: '123456789',
        HEYDO_FIREBASE_PROJECT_ID: 'example-project',
      }),
    );
    writeFileSync(
      credentialPath,
      JSON.stringify({
        type: 'service_account',
        project_id: 'example-project',
        client_email: clientEmail,
        private_key: privateKey,
      }),
    );

    const result = runReadiness({
      HEYDO_FIREBASE_CLIENT_CONFIG: clientPath,
      PUSH_PROVIDER: 'fcm',
      FIREBASE_PROJECT_ID: 'example-project',
      GOOGLE_APPLICATION_CREDENTIALS: credentialPath,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /readyForFirebaseDeviceQa=true/);
    assert.doesNotMatch(result.stdout, new RegExp(apiKey));
    assert.doesNotMatch(result.stdout, new RegExp(clientEmail));
    assert.doesNotMatch(result.stdout, /fake-test-material/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fails closed when configuration is absent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'heydo-firebase-missing-'));
  try {
    const result = runReadiness({
      HEYDO_FIREBASE_CLIENT_CONFIG: join(directory, 'missing.json'),
      PUSH_PROVIDER: '',
      FIREBASE_PROJECT_ID: '',
      GOOGLE_APPLICATION_CREDENTIALS: '',
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /readyForFirebaseDeviceQa=false/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runReadiness(overrides) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, ...overrides },
  });
}
