import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./mobile-device-qa.mjs', import.meta.url));

test('passes only when Firebase, backend, and physical Android are ready', () => {
  const result = runDeviceQa({
    HEYDO_DEVICE_QA_FIREBASE_READY: '1',
    HEYDO_DEVICE_QA_BACKEND_READY: '1',
    HEYDO_DEVICE_QA_FLUTTER_DEVICES_JSON: JSON.stringify([
      {
        id: 'RF8M123456',
        name: 'Samsung A series',
        targetPlatform: 'android-arm64',
        platformType: 'android',
      },
    ]),
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /readyForPhysicalDeviceQa=true/);
  assert.match(result.stdout, /--dart-define-from-file=firebase\.local\.json/);
});

test('fails when only an emulator is connected', () => {
  const result = runDeviceQa({
    HEYDO_DEVICE_QA_FIREBASE_READY: '1',
    HEYDO_DEVICE_QA_BACKEND_READY: '1',
    HEYDO_DEVICE_QA_FLUTTER_DEVICES_JSON: JSON.stringify([
      {
        id: 'emulator-5554',
        name: 'sdk gphone64 x86 64',
        targetPlatform: 'android-x64',
        platformType: 'android',
        emulator: true,
      },
    ]),
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /physicalAndroidDeviceConnected=missing/);
  assert.match(result.stdout, /readyForPhysicalDeviceQa=false/);
});

function runDeviceQa(overrides) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HEYDO_API_BASE: 'http://10.0.0.7:3000',
      ...overrides,
    },
  });
}
