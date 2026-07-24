import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
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
const apiPublic = parseHttpsUrl(apiPublicUrl);
const corsOrigins = splitList(process.env.CORS_ORIGINS);
const corsUrls = corsOrigins.map(parseHttpsUrl);
const diditCallbackUrl = process.env.DIDIT_CALLBACK_URL ?? '';
const diditCallback = parseHttpsUrl(diditCallbackUrl);
const credentialPathValue = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? '';
const credentialPath = credentialPathValue
  ? isAbsolute(credentialPathValue)
    ? credentialPathValue
    : resolve(root, credentialPathValue)
  : '';
const serviceAccount = readJson(credentialPath);

const checks = {
  nodeEnvProduction: process.env.NODE_ENV === 'production',
  apiPublicUrlConfigured: Boolean(apiPublic),
  apiPublicUrlLooksDurable: isDurablePublicUrl(apiPublic),
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
  firebaseCredentialsFileExists: Boolean(credentialPath) && existsSync(credentialPath),
  firebaseCredentialsOutsideRepo:
    Boolean(credentialPath) && !isPathInside(credentialPath, root),
  firebaseCredentialsLookValid:
    serviceAccount?.type === 'service_account' &&
    Boolean(stringValue(serviceAccount, 'client_email')) &&
    Boolean(stringValue(serviceAccount, 'private_key')) &&
    stringValue(serviceAccount, 'project_id') === (process.env.FIREBASE_PROJECT_ID ?? '').trim(),
  diditProviderEnabled: process.env.VKYC_PROVIDER === 'didit',
  diditApiKeyConfigured: hasValue('DIDIT_API_KEY'),
  workerWorkflowConfigured: hasValue('DIDIT_WORKFLOW_ID'),
  giverWorkflowConfigured: hasValue('DIDIT_GIVER_WORKFLOW_ID'),
  diditWebhookSecretConfigured: hasValue('DIDIT_WEBHOOK_SECRET'),
  diditCallbackUrlConfigured: Boolean(diditCallback),
  diditCallbackUrlLooksDurable: isDurablePublicUrl(diditCallback),
  diditCallbackUrlMatchesApiHost:
    Boolean(apiPublic && diditCallback) && apiPublic.host === diditCallback.host,
  corsOriginsConfigured: corsOrigins.length > 0,
  corsOriginsAreHttps: corsOrigins.length > 0 && corsUrls.every(Boolean),
  corsOriginsLookDurable: corsUrls.length > 0 && corsUrls.every(isDurablePublicUrl),
  corsOriginsDoNotAllowApiHost:
    Boolean(apiPublic) && corsUrls.every((origin) => origin?.host !== apiPublic.host),
};

const required = Object.keys(checks);
const missing = required.filter((key) => !checks[key]);
const readyForDurableBackend = missing.length === 0;

console.log('Heydo backend deployment readiness');
console.log(`apiPublicHost=${apiPublic?.host ?? 'missing'}`);
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
  return Boolean(parseHttpsUrl(value));
}

function parseHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function isDurablePublicUrl(url) {
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return ![
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
  ].includes(host) &&
    !host.endsWith('.localhost') &&
    !host.endsWith('.trycloudflare.com') &&
    !host.endsWith('.ngrok-free.app') &&
    !host.endsWith('.ngrok.io');
}

function readJson(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function stringValue(source, key) {
  return typeof source?.[key] === 'string' ? source[key].trim() : '';
}

function isPathInside(child, parent) {
  const path = relative(resolve(parent), resolve(child));
  return Boolean(path) && !path.startsWith('..') && !isAbsolute(path);
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
