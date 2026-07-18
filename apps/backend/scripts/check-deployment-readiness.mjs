import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const backend = resolve(here, '..');

for (const file of [
  resolve(root, '.env.local'),
  resolve(root, '.env'),
  resolve(backend, '.env.local'),
  resolve(backend, '.env'),
]) {
  loadEnvFile(file);
}

const apiPublicUrl = process.env.API_PUBLIC_URL ?? '';
const corsOrigins = splitList(process.env.CORS_ORIGINS);
const checks = {
  nodeEnvProduction: process.env.NODE_ENV === 'production',
  apiPublicUrlConfigured: isHttpsUrl(apiPublicUrl),
  apiPublicUrlLooksDurable: isHttpsUrl(apiPublicUrl) && !apiPublicUrl.includes('trycloudflare.com'),
  portConfigured: hasValue('PORT'),
  postgresPersistenceEnabled: process.env.PERSISTENCE === 'postgres',
  databaseUrlConfigured: hasValue('DATABASE_URL'),
  databaseSslEnabled: process.env.DATABASE_SSL === 'true',
  jwtSecretConfigured: hasSafeSecret('JWT_SECRET', ['dev-only-change-me']),
  piiEncryptionKeyConfigured: hasSafeSecret('PII_ENCRYPTION_KEY', ['dev-only-32-byte-key-change-me!!']),
  pushTokenEncryptionKeyConfigured: hasSafeSecret('PUSH_TOKEN_ENCRYPTION_KEY', ['dev-only-push-token-key-change-me']),
  fcmPushProviderEnabled: process.env.PUSH_PROVIDER === 'fcm',
  firebaseProjectConfigured: hasValue('FIREBASE_PROJECT_ID'),
  firebaseCredentialsConfigured: hasValue('GOOGLE_APPLICATION_CREDENTIALS'),
  diditProviderEnabled: process.env.VKYC_PROVIDER === 'didit',
  diditApiKeyConfigured: hasValue('DIDIT_API_KEY'),
  workerWorkflowConfigured: hasValue('DIDIT_WORKFLOW_ID'),
  giverWorkflowConfigured: hasValue('DIDIT_GIVER_WORKFLOW_ID'),
  diditWebhookSecretConfigured: hasValue('DIDIT_WEBHOOK_SECRET'),
  diditCallbackUrlConfigured: isHttpsUrl(process.env.DIDIT_CALLBACK_URL ?? ''),
  corsOriginsConfigured: corsOrigins.length > 0,
  corsOriginsAreHttps: corsOrigins.length > 0 && corsOrigins.every(isHttpsUrl),
};

const required = Object.keys(checks);
const missing = required.filter((key) => !checks[key]);
const readyForDurableBackend = missing.length === 0;

console.log('Heydo backend deployment readiness');
console.log(`apiPublicHost=${apiPublicUrl ? new URL(apiPublicUrl).host : 'missing'}`);
console.log('healthPath=/health');
console.log('diditWebhookDestination=/webhooks/didit');
for (const [key, ok] of Object.entries(checks)) {
  console.log(`${key}=${ok ? 'ok' : 'missing'}`);
}

if (!readyForDurableBackend) {
  console.log('readyForDurableBackend=false');
  console.log(`missingRequiredChecks=${missing.join(',')}`);
  process.exitCode = 1;
} else {
  console.log('readyForDurableBackend=true');
  console.log(`diditWebhookUrl=${apiPublicUrl.replace(/\/$/, '')}/webhooks/didit`);
  console.log(`healthUrl=${apiPublicUrl.replace(/\/$/, '')}/health`);
}

function hasValue(key) {
  return Boolean(process.env[key]?.trim());
}

function hasSafeSecret(key, unsafeValues) {
  const value = process.env[key]?.trim();
  return Boolean(value) && !unsafeValues.includes(value);
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function splitList(value) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
