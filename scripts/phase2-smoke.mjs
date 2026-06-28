// Phase 2 applicant-model smoke helper.
//
// Usage:
//   node scripts/phase2-smoke.mjs setup   # create giver + 3 worker VKYC sessions
//   node scripts/phase2-smoke.mjs ingest  # ingest vendor results and approve workers when possible
//   node scripts/phase2-smoke.mjs run     # post -> 3 apply -> choose -> start -> complete -> dual rate
//   node scripts/phase2-smoke.mjs all     # setup + ingest + run; works fully with VKYC_PROVIDER=mock
//
// With Didit, run setup, complete the printed sessions in Didit, then run ingest
// until workers/giver are eligible. This script does not bypass KYC.

import { readFile, writeFile } from 'node:fs/promises';

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000';
const ADMIN_DEV_SECRET = process.env.ADMIN_DEV_SECRET ?? 'dev-admin-secret';
const STATE_FILE = new URL('../.phase2-smoke.json', import.meta.url);

const WORKER_COUNT = 3;

async function request(path, { method = 'GET', token, body, allowFailure = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(async () => {
    const text = await res.text().catch(() => '');
    return text ? { raw: text } : {};
  });
  if (!res.ok && !allowFailure) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${JSON.stringify(payload)}`);
  }
  return { ok: res.ok, status: res.status, payload };
}

async function requireBackend() {
  await request('/health');
}

async function loadState() {
  return JSON.parse(await readFile(STATE_FILE, 'utf8'));
}

async function saveState(state) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

function randomPhone() {
  return `+9192${Math.floor(10000000 + Math.random() * 89999999)}`;
}

async function createUser(role, displayName) {
  const phone = randomPhone();
  const otp = await request('/auth/otp/request', {
    method: 'POST',
    body: { phone },
  });
  if (!otp.payload.devCode) {
    throw new Error('Dev OTP code missing. Use local dev/mock OTP sender for the smoke helper.');
  }
  const login = await request('/auth/otp/verify', {
    method: 'POST',
    body: { phone, code: otp.payload.devCode },
  });
  await request('/identity/role', {
    method: 'POST',
    token: login.payload.token,
    body: { role, displayName },
  });
  await request('/verification/consent', {
    method: 'POST',
    token: login.payload.token,
    body: {},
  });
  const startPath = role === 'giver' ? '/verification/giver/start' : '/verification/start';
  const session = await request(startPath, {
    method: 'POST',
    token: login.payload.token,
    body: { locale: 'ml' },
  });
  return {
    role,
    displayName,
    phone,
    token: login.payload.token,
    userId: login.payload.user.id,
    sessionId: session.payload.sessionId,
    launchUrl: session.payload.launchToken,
    vendor: session.payload.vendor,
  };
}

async function adminToken() {
  const login = await request('/admin/auth/dev-login', {
    method: 'POST',
    body: {
      secret: ADMIN_DEV_SECRET,
      adminId: 'phase2-smoke-officer',
      roles: ['verification_officer', 'fraud_analyst', 'support', 'finance', 'super_admin'],
    },
  });
  return login.payload.token;
}

async function setup() {
  await requireBackend();
  const giver = await createUser('giver', 'Phase 2 Smoke Giver');
  const workers = [];
  for (let index = 0; index < WORKER_COUNT; index += 1) {
    workers.push(await createUser('worker', `Phase 2 Smoke Worker ${index + 1}`));
  }
  const state = {
    createdAt: new Date().toISOString(),
    giver,
    workers,
  };
  await saveState(state);
  console.log(JSON.stringify({
    status: 'created',
    stateFile: '.phase2-smoke.json',
    giver: publicSession(giver),
    workers: workers.map(publicSession),
    next:
      'Complete these sessions in Didit if using VKYC_PROVIDER=didit, then run: node scripts/phase2-smoke.mjs ingest',
  }, null, 2));
}

async function ingest() {
  await requireBackend();
  const state = await loadState();
  const officerToken = await adminToken();
  const giver = await ingestSubject(state.giver, officerToken);
  const workers = [];
  for (const worker of state.workers) {
    workers.push(await ingestSubject(worker, officerToken));
  }
  const nextState = { ...state, giver, workers, ingestedAt: new Date().toISOString() };
  await saveState(nextState);
  const readiness = await readiness(nextState);
  console.log(JSON.stringify({
    status: readiness.ready ? 'ready_for_phase2_run' : 'waiting_for_kyc',
    giver: readiness.giver,
    workers: readiness.workers,
    next: readiness.ready
      ? 'Run: node scripts/phase2-smoke.mjs run'
      : 'Finish pending Didit/admin reviews, then rerun: node scripts/phase2-smoke.mjs ingest',
  }, null, 2));
}

async function ingestSubject(subject, officerToken) {
  const result = await request('/verification/result', {
    method: 'POST',
    token: subject.token,
    body: { sessionId: subject.sessionId },
    allowFailure: true,
  });
  const statusPath = subject.role === 'giver' ? '/verification/giver/status' : '/verification/status';
  let status = (await request(statusPath, { token: subject.token })).payload;

  if (!result.ok && result.status !== 409) {
    throw new Error(`VKYC result failed for ${subject.displayName}: ${JSON.stringify(result.payload)}`);
  }

  if (subject.role === 'worker' && status.status === 'pending') {
    const adminView = await request(
      `/admin/verifications/sessions/${encodeURIComponent(subject.sessionId)}`,
      { token: officerToken },
    );
    if (adminView.payload.vendorResultAt) {
      await request(`/admin/verifications/${adminView.payload.id}/approve`, {
        method: 'POST',
        token: officerToken,
        body: {},
      });
      status = (await request(statusPath, { token: subject.token })).payload;
    }
  }

  return {
    ...subject,
    verificationStatus: status.status,
    canApply: Boolean(status.canApply),
    canPost: Boolean(status.canPost),
    resultStatus: result.ok ? 'ingested' : result.payload.code ?? `http_${result.status}`,
  };
}

async function readiness(state) {
  const giverStatus = (await request('/verification/giver/status', { token: state.giver.token })).payload;
  const workers = [];
  for (const worker of state.workers) {
    workers.push({
      userId: worker.userId,
      displayName: worker.displayName,
      ...(await request('/verification/status', { token: worker.token })).payload,
    });
  }
  return {
    ready: Boolean(giverStatus.canPost) && workers.filter((worker) => worker.canApply).length >= WORKER_COUNT,
    giver: {
      userId: state.giver.userId,
      displayName: state.giver.displayName,
      status: giverStatus.status,
      canPost: Boolean(giverStatus.canPost),
    },
    workers,
  };
}

async function run() {
  await requireBackend();
  const state = await loadState();
  const ready = await readiness(state);
  if (!ready.ready) {
    throw new Error(`Phase 2 smoke not ready: ${JSON.stringify(ready, null, 2)}`);
  }

  const scheduledAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const gig = await request('/marketplace/gigs', {
    method: 'POST',
    token: state.giver.token,
    body: {
      categoryId: 'cat_cleaning',
      title: 'Family home cleaning',
      description: 'Need cleaning help for a family home living room and kitchen in Kochi.',
      location: 'Kochi',
      scheduledAt,
      budgetAmount: 1200,
    },
  });

  const applicationInputs = [
    { messageMl: 'I can come on time and clean the rooms carefully.' },
    { messageMl: 'I can bring supplies and finish quickly.', proposedPrice: 1700 },
    { messageMl: 'I have event cleaning experience.', proposedPrice: 2200 },
  ];
  const applications = [];
  for (let index = 0; index < WORKER_COUNT; index += 1) {
    const application = await request(`/marketplace/gigs/${gig.payload.id}/applications`, {
      method: 'POST',
      token: state.workers[index].token,
      body: applicationInputs[index],
    });
    applications.push(application.payload);
  }

  const listedApplications = await request(`/marketplace/gigs/${gig.payload.id}/applications`, {
    token: state.giver.token,
  });
  if (listedApplications.payload.length < WORKER_COUNT) {
    throw new Error(`Expected ${WORKER_COUNT} applications, got ${listedApplications.payload.length}`);
  }

  const selectedApplication = applications[1];
  const selection = await request(
    `/marketplace/gigs/${gig.payload.id}/applications/${selectedApplication.id}/select`,
    { method: 'POST', token: state.giver.token, body: {} },
  );
  await request(`/marketplace/gigs/${gig.payload.id}/start`, {
    method: 'POST',
    token: state.workers[1].token,
    body: {},
  });
  await request(`/marketplace/gigs/${gig.payload.id}/complete`, {
    method: 'POST',
    token: state.giver.token,
    body: {},
  });
  await request(`/marketplace/gigs/${gig.payload.id}/ratings`, {
    method: 'POST',
    token: state.giver.token,
    body: {
      stars: 5,
      tags: ['on_time', 'careful_work'],
      comment: 'Clean work and respectful conduct.',
    },
  });
  await request(`/marketplace/gigs/${gig.payload.id}/ratings`, {
    method: 'POST',
    token: state.workers[1].token,
    body: {
      stars: 5,
      tags: ['clear_scope', 'safe_location'],
      comment: 'Clear instructions and safe family home.',
    },
  });
  const finalGig = await request(`/marketplace/gigs/${gig.payload.id}`, { token: state.giver.token });
  const ratings = await request(`/marketplace/gigs/${gig.payload.id}/ratings`, { token: state.giver.token });
  const selectedWorkerBalance = await request('/marketplace/proposal-token-balance', {
    token: state.workers[1].token,
  });

  const nextState = {
    ...state,
    lastRun: {
      at: new Date().toISOString(),
      gigId: gig.payload.id,
      selectedApplicationId: selectedApplication.id,
      selectedWorkerId: state.workers[1].userId,
      assignmentId: selection.payload.assignment.id,
    },
  };
  await saveState(nextState);

  console.log(JSON.stringify({
    status: 'phase2_smoke_passed',
    gigId: gig.payload.id,
    visibilityStatus: gig.payload.visibilityStatus,
    applications: listedApplications.payload.length,
    selectedWorkerId: state.workers[1].userId,
    agreedAmount: selection.payload.assignment.agreedAmount,
    platformFeeAmount: selection.payload.assignment.platformFeeAmount,
    workerPayoutAmount: selection.payload.assignment.workerPayoutAmount,
    selectedWorkerProposalTokenBalance: selectedWorkerBalance.payload.balance,
    finalGigStatus: finalGig.payload.status,
    ratingCount: ratings.payload.length,
  }, null, 2));
}

function publicSession(subject) {
  return {
    role: subject.role,
    userId: subject.userId,
    displayName: subject.displayName,
    sessionId: subject.sessionId,
    launchUrl: subject.launchUrl,
  };
}

async function main() {
  const command = process.argv[2] ?? 'help';
  if (command === 'setup') return setup();
  if (command === 'ingest') return ingest();
  if (command === 'run') return run();
  if (command === 'all') {
    await setup();
    await ingest();
    return run();
  }
  console.log(`Usage:
  node scripts/phase2-smoke.mjs setup
  node scripts/phase2-smoke.mjs ingest
  node scripts/phase2-smoke.mjs run
  node scripts/phase2-smoke.mjs all

Environment:
  API_BASE=http://127.0.0.1:3000
  ADMIN_DEV_SECRET=dev-admin-secret`);
}

await main();
