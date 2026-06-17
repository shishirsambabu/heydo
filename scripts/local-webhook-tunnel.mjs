import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cloudflared =
  process.env.CLOUDFLARED_PATH ??
  'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';

const pids = [];

const backendOut = openSync(new URL('../.backend-local.out.log', import.meta.url), 'w');
const backendErr = openSync(new URL('../.backend-local.err.log', import.meta.url), 'w');
const backend = spawn('C:\\Program Files\\nodejs\\node.exe', ['apps/backend/dist/main.js'], {
  cwd: root,
  detached: true,
  env: { ...process.env, NODE_ENV: 'development', PORT: '3000' },
  stdio: ['ignore', backendOut, backendErr],
});
backend.unref();
pids.push(backend.pid);

await waitForHealth();

const tunnelLog = new URL('../.cloudflared.log', import.meta.url);
const tunnelOut = openSync(tunnelLog, 'w');
const tunnel = spawn(cloudflared, ['tunnel', '--url', 'http://localhost:3000'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', tunnelOut, tunnelOut],
});
tunnel.unref();
pids.push(tunnel.pid);

await writeFile(new URL('../.local-webhook-pids', import.meta.url), `${pids.join('\n')}\n`);

const url = await waitForTunnelUrl(tunnelLog);
console.log(JSON.stringify({
  backend: 'http://127.0.0.1:3000/health',
  tunnel: url,
  diditWebhookUrl: `${url}/webhooks/didit`,
  pids,
}, null, 2));

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:3000/health');
      if (res.ok) return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error('Backend did not become healthy on http://127.0.0.1:3000/health');
}

async function waitForTunnelUrl(logPath) {
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    const text = await readFile(logPath, 'utf8').catch(() => '');
    const match = text.match(/https:\/\/[-a-zA-Z0-9]+\.trycloudflare\.com/);
    if (match) return match[0];
  }
  throw new Error('cloudflared did not emit a trycloudflare.com URL');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
