import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = resolve(root, 'apps/mobile');
const apiBase = (process.env.HEYDO_API_BASE ?? 'http://localhost:3000').replace(/\/+$/, '');
const defaultFlutter = join(homedir(), 'development', 'flutter', 'bin', 'flutter.bat');
const flutterCommand = process.env.HEYDO_FLUTTER_COMMAND?.trim()
  || (process.platform === 'win32' && existsSync(defaultFlutter) ? defaultFlutter : 'flutter');

const checks = [];

console.log('Heydo physical Android Phase 2 QA readiness');
console.log('apiBase=' + apiBase);

const firebaseReady = checkFirebase();
checks.push(['firebaseReady', firebaseReady.ok, firebaseReady.detail]);

const backendReady = await checkBackendHealth();
checks.push(['backendReachable', backendReady.ok, backendReady.detail]);

const deviceReady = checkPhysicalAndroidDevice();
checks.push(['physicalAndroidDeviceConnected', deviceReady.ok, deviceReady.detail]);

for (const [name, ok, detail] of checks) {
  console.log(`${name}=${ok ? 'ok' : 'missing'}${detail ? ` (${detail})` : ''}`);
}

const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(`readyForPhysicalDeviceQa=${missing.length === 0}`);

if (missing.length > 0) {
  console.log(`missingRequiredChecks=${missing.join(',')}`);
  console.log('Fix the missing checks, then rerun:');
  console.log('  npm run mobile:device:qa');
  process.exitCode = 1;
} else {
  console.log('Run this from apps/mobile with the connected Android phone:');
  console.log(`  cd ${mobileRoot}`);
  console.log(`  "${flutterCommand}" run --dart-define-from-file=firebase.local.json --dart-define=HEYDO_API_BASE=${apiBase}`);
}

function checkFirebase() {
  if (process.env.HEYDO_DEVICE_QA_FIREBASE_READY === '1') {
    return { ok: true, detail: 'test override' };
  }
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/firebase-readiness.mjs')], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status === 0 && result.stdout.includes('readyForFirebaseDeviceQa=true')) {
    return { ok: true, detail: 'client and backend config ready' };
  }
  return { ok: false, detail: 'run npm run firebase:readiness for exact missing fields' };
}

async function checkBackendHealth() {
  if (process.env.HEYDO_DEVICE_QA_BACKEND_READY === '1') {
    return { ok: true, detail: 'test override' };
  }
  try {
    const response = await fetch(`${apiBase}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const body = await response.text();
    return {
      ok: body.includes('"status":"ok"') || body.includes('ok'),
      detail: 'health endpoint answered',
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'health check failed',
    };
  }
}

function checkPhysicalAndroidDevice() {
  const devicesJson = process.env.HEYDO_DEVICE_QA_FLUTTER_DEVICES_JSON
    ?? readFlutterDevices();
  if (!devicesJson) return { ok: false, detail: 'flutter devices returned no data' };
  try {
    const devices = JSON.parse(devicesJson);
    const androidDevices = Array.isArray(devices)
      ? devices.filter((device) =>
          device?.targetPlatform === 'android-arm64'
          || device?.targetPlatform === 'android-arm'
          || device?.platformType === 'android')
      : [];
    const physical = androidDevices.filter((device) => !isEmulator(device));
    if (physical.length > 0) {
      return { ok: true, detail: `${physical.length} physical Android device(s)` };
    }
    if (androidDevices.length > 0) {
      return { ok: false, detail: 'only emulator Android devices found' };
    }
    return { ok: false, detail: 'no Android phone found' };
  } catch {
    return { ok: false, detail: 'could not parse flutter devices --machine output' };
  }
}

function readFlutterDevices() {
  const result = spawnSync(flutterCommand, ['devices', '--machine'], {
    cwd: mobileRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 30000,
  });
  if (result.status !== 0) return '';
  return result.stdout;
}

function isEmulator(device) {
  const text = [
    device?.id,
    device?.name,
    device?.emulator,
    device?.sdk,
    device?.category,
  ].join(' ').toLowerCase();
  return device?.emulator === true
    || text.includes('emulator')
    || text.includes('sdk gphone')
    || text.includes('avd');
}
