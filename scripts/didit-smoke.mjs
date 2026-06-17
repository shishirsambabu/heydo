// Local Didit VKYC smoke helper.
//
// Usage:
//   node scripts/didit-smoke.mjs start   # creates a worker + Didit session
//   node scripts/didit-smoke.mjs result  # ingests Didit's final decision after completion
//
// Prereq: backend running with VKYC_PROVIDER=didit and Didit env vars loaded.

import { readFile, writeFile } from 'node:fs/promises';

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000';
const STATE_FILE = new URL('../.didit-smoke.json', import.meta.url);

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${text}`);
  }
  return res.status === 204 ? {} : res.json().catch(() => ({}));
}

async function requestJson(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(async () => ({ raw: await res.text() }));
  return { ok: res.ok, status: res.status, payload };
}

async function start() {
  await request('/health');
  const phone = `+9190000${Math.floor(10000 + Math.random() * 89999)}`;
  const otp = await request('/auth/otp/request', {
    method: 'POST',
    body: { phone },
  });
  if (!otp.devCode) {
    throw new Error('Dev OTP code missing. Run with NODE_ENV != production and mock OTP sender.');
  }
  const login = await request('/auth/otp/verify', {
    method: 'POST',
    body: { phone, code: otp.devCode },
  });
  await request('/identity/role', {
    method: 'POST',
    token: login.token,
    body: { role: 'worker', displayName: 'Didit Sandbox Worker' },
  });
  await request('/verification/consent', {
    method: 'POST',
    token: login.token,
    body: {},
  });
  const session = await request('/verification/start', {
    method: 'POST',
    token: login.token,
    body: { locale: 'ml' },
  });

  const state = {
    phone,
    token: login.token,
    sessionId: session.sessionId,
    launchUrl: session.launchToken,
    vendor: session.vendor,
    createdAt: new Date().toISOString(),
  };
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({
    status: 'created',
    vendor: session.vendor,
    sessionId: session.sessionId,
    launchUrl: session.launchToken,
    stateFile: '.didit-smoke.json',
  }, null, 2));
}

async function result() {
  const state = JSON.parse(await readFile(STATE_FILE, 'utf8'));
  const decision = await requestJson('/verification/result', {
    method: 'POST',
    token: state.token,
    body: { sessionId: state.sessionId },
  });
  const status = await request('/verification/status', { token: state.token });
  if (!decision.ok && decision.status === 409 && decision.payload.code === 'result_not_final') {
    console.log(JSON.stringify({
      status: 'waiting',
      sessionId: state.sessionId,
      reason: decision.payload.code,
      verificationStatus: status.status,
      canApply: status.canApply,
    }, null, 2));
    return;
  }
  if (!decision.ok) {
    throw new Error(`POST /verification/result -> HTTP ${decision.status}: ${JSON.stringify(decision.payload)}`);
  }
  console.log(JSON.stringify({
    status: 'ingested',
    sessionId: state.sessionId,
    verificationStatus: decision.payload.status,
    canApply: status.canApply,
  }, null, 2));
}

const command = process.argv[2] ?? 'start';
if (command === 'start') await start();
else if (command === 'result') await result();
else throw new Error(`Unknown command '${command}'. Use 'start' or 'result'.`);
