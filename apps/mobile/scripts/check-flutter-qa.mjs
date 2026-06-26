import { spawnSync } from 'node:child_process';

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
    cwd: new URL('..', import.meta.url),
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error?.code === 'ENOENT' || (command === 'flutter' && args[0] === '--version' && result.status !== 0)) {
    console.error(
      '\nFlutter is not installed or not on PATH. Install Flutter 3.22+ and Android tooling, then rerun npm run mobile:qa.',
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nHeydo mobile QA checks passed.');
