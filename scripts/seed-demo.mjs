// Seeds the running Heydo backend with a few workers who have completed VKYC
// and are awaiting officer review — so the admin queue has something to show.
//
// Usage: node scripts/seed-demo.mjs        (backend must be running on :3000)
// Node 18+ has global fetch.

const BASE = process.env.API_BASE ?? 'http://localhost:3000';

const demoWorkers = [
  { name: 'Ravi Kumar', locale: 'ml' },
  { name: 'Meera Suresh', locale: 'ml' },
  { name: 'Anil Thomas', locale: 'ml' },
];

async function post(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.status === 200 || res.status === 201 ? res.json().catch(() => ({})) : {};
}

async function seedWorker(w) {
  const phone = '+91' + String(9000000000 + Math.floor(Math.random() * 99999999)).slice(0, 10);
  const otp = await post('/auth/otp/request', { phone });
  const login = await post('/auth/otp/verify', { phone, code: otp.devCode });
  const token = login.token;
  await post('/identity/role', { role: 'worker', displayName: w.name }, token);
  await post('/verification/consent', {}, token);
  const start = await post('/verification/start', { locale: w.locale }, token);
  await post('/verification/result', { sessionId: start.sessionId }, token);
  return { name: w.name, phone };
}

(async () => {
  try {
    await fetch(`${BASE}/health`);
  } catch {
    console.error(`Backend not reachable at ${BASE}. Start it first (see docs/phase-1/RUN_LOCALLY.md).`);
    process.exit(1);
  }
  const seeded = [];
  for (const w of demoWorkers) {
    seeded.push(await seedWorker(w));
  }
  console.log(`Seeded ${seeded.length} workers awaiting VKYC review:`);
  seeded.forEach((s) => console.log(`  • ${s.name} (${s.phone})`));
  console.log('\nOpen the admin → VKYC queue to review them: http://localhost:3001');
})();
