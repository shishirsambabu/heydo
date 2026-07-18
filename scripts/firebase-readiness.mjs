import { existsSync, readFileSync, copyFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = resolve(root, 'apps/mobile');
const clientConfigPath = process.env.HEYDO_FIREBASE_CLIENT_CONFIG
  ? resolve(process.env.HEYDO_FIREBASE_CLIENT_CONFIG)
  : resolve(mobileRoot, 'firebase.local.json');
const clientExamplePath = resolve(mobileRoot, 'firebase.local.example.json');

for (const file of [
  resolve(root, '.env.local'),
  resolve(root, '.env'),
  resolve(root, 'apps/backend/.env.local'),
  resolve(root, 'apps/backend/.env'),
]) {
  loadEnvFile(file);
}

if (process.argv[2] === 'init') {
  if (!existsSync(clientConfigPath)) {
    copyFileSync(clientExamplePath, clientConfigPath);
    console.log('Created apps/mobile/firebase.local.json from the safe template.');
  } else {
    console.log('apps/mobile/firebase.local.json already exists; no changes made.');
  }
  console.log('Fill it with the Android app values for package in.heydo.app, then run:');
  console.log('  npm run firebase:readiness');
  process.exit(0);
}

const client = readJson(clientConfigPath);
const credentialPathValue = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? '';
const credentialPath = credentialPathValue
  ? isAbsolute(credentialPathValue)
    ? credentialPathValue
    : resolve(root, credentialPathValue)
  : '';
const serviceAccount = readJson(credentialPath);
const androidGradle = readText(resolve(mobileRoot, 'android/app/build.gradle.kts'));
const iosProject = readText(resolve(mobileRoot, 'ios/Runner.xcodeproj/project.pbxproj'));

const clientProjectId = stringValue(client, 'HEYDO_FIREBASE_PROJECT_ID');
const backendProjectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? '';
const serviceProjectId = stringValue(serviceAccount, 'project_id');
const clientAppId = stringValue(client, 'HEYDO_FIREBASE_APP_ID');
const senderId = stringValue(client, 'HEYDO_FIREBASE_MESSAGING_SENDER_ID');
const apiKey = stringValue(client, 'HEYDO_FIREBASE_API_KEY');

const checks = {
  androidApplicationIdCorrect: androidGradle.includes('applicationId = "in.heydo.app"'),
  iosBundleIdCorrect: iosProject.includes('PRODUCT_BUNDLE_IDENTIFIER = in.heydo.app;'),
  mobileConfigFileExists: existsSync(clientConfigPath),
  mobileFirebaseEnabled: client?.HEYDO_FIREBASE_ENABLED === true,
  mobileApiKeyConfigured: /^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey),
  mobileAndroidAppIdConfigured: /^1:\d+:android:[0-9a-f]+$/i.test(clientAppId),
  mobileSenderIdConfigured: /^\d{6,}$/.test(senderId),
  mobileProjectIdConfigured: /^[a-z][a-z0-9-]{4,29}$/.test(clientProjectId),
  backendFcmProviderEnabled: process.env.PUSH_PROVIDER === 'fcm',
  backendProjectIdConfigured: Boolean(backendProjectId),
  serviceAccountPathConfigured: Boolean(credentialPathValue),
  serviceAccountFileExists: Boolean(credentialPath) && existsSync(credentialPath),
  serviceAccountLooksValid:
    serviceAccount?.type === 'service_account' &&
    Boolean(stringValue(serviceAccount, 'client_email')) &&
    Boolean(stringValue(serviceAccount, 'private_key')),
  projectIdsMatch:
    Boolean(clientProjectId) &&
    clientProjectId === backendProjectId &&
    clientProjectId === serviceProjectId,
};

const missing = Object.entries(checks)
  .filter(([, ok]) => !ok)
  .map(([name]) => name);

console.log('Heydo Firebase physical-device readiness');
console.log('androidPackage=in.heydo.app');
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${name}=${ok ? 'ok' : 'missing'}`);
}
console.log(`readyForFirebaseDeviceQa=${missing.length === 0}`);

if (missing.length > 0) {
  console.log(`missingRequiredChecks=${missing.join(',')}`);
  if (!existsSync(clientConfigPath)) {
    console.log('Initialize the gitignored mobile configuration with:');
    console.log('  npm run firebase:readiness -- init');
  } else {
    console.log('Complete apps/mobile/firebase.local.json and the backend Firebase values described in apps/mobile/FIREBASE_SETUP.md.');
  }
  process.exitCode = 1;
} else {
  console.log('Run from apps/mobile with a physical Android device connected:');
  console.log('  flutter run --dart-define-from-file=firebase.local.json --dart-define=HEYDO_API_BASE=http://YOUR_PC_LAN_IP:3000');
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
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

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
