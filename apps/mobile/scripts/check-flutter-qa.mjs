import { spawnSync } from 'node:child_process';

const mobileRoot = new URL('..', import.meta.url);

const commands = [
  ['flutter', ['--version']],
  ['flutter', ['pub', 'get']],
  ['flutter', ['analyze']],
  ['flutter', ['test']],
];

if (process.env.HEYDO_MOBILE_BUILD === '1') {
  commands.push(['flutter', ['build', 'apk', '--debug']]);
}

for (const [command, args] of commands) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: mobileRoot,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error?.code === 'ENOENT' || (command === 'flutter' && args[0] === '--version' && result.status !== 0)) {
    console.error('\nFlutter is not installed or not on PATH.');
    console.error('\nWindows setup helper:');
    console.error('  npm run mobile:setup:windows');
    console.error('\nThen open a new PowerShell window and rerun:');
    console.error('  npm run mobile:qa');
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nHeydo mobile QA checks passed.');
console.log('\nFor real-device Phase 2 QA, run from apps/mobile:');
console.log('  flutter run --dart-define=HEYDO_API_BASE=http://YOUR_PC_LAN_IP:3000');
