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

const provider = process.env.VKYC_PROVIDER ?? 'mock';
const persistence = process.env.PERSISTENCE ?? 'memory';
const checks = {
  diditProviderEnabled: provider === 'didit',
  diditApiKeyConfigured: hasValue('DIDIT_API_KEY'),
  workerWorkflowConfigured: hasValue('DIDIT_WORKFLOW_ID'),
  giverWorkflowConfigured: hasValue('DIDIT_GIVER_WORKFLOW_ID'),
  webhookSecretConfigured: hasValue('DIDIT_WEBHOOK_SECRET'),
  callbackUrlConfigured: hasValue('DIDIT_CALLBACK_URL'),
  postgresPersistenceEnabled: persistence === 'postgres',
  databaseUrlConfigured: hasValue('DATABASE_URL'),
};

const required = [
  'diditProviderEnabled',
  'diditApiKeyConfigured',
  'workerWorkflowConfigured',
  'giverWorkflowConfigured',
  'webhookSecretConfigured',
  'postgresPersistenceEnabled',
  'databaseUrlConfigured',
];
const missing = required.filter((key) => !checks[key]);
const readyForLiveDidit = missing.length === 0;

console.log('Heydo VKYC readiness');
console.log(`provider=${provider}`);
console.log(`persistence=${persistence}`);
console.log('webhookDestinationPath=/webhooks/didit');
for (const [key, ok] of Object.entries(checks)) {
  console.log(`${key}=${ok ? 'ok' : 'missing'}`);
}

if (!readyForLiveDidit) {
  console.log(`readyForLiveDidit=false`);
  console.log(`missingRequiredChecks=${missing.join(',')}`);
  process.exitCode = 1;
} else {
  console.log('readyForLiveDidit=true');
  console.log('nextManualChecks=worker workflow, giver workflow, live Approved/Declined callbacks');
}

function hasValue(key) {
  return Boolean(process.env[key]?.trim());
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
