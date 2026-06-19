# Run Heydo locally (Phase 1)

> How to see the Phase 1 build with your own eyes: the **admin panel** (in your browser) and the
> **Flutter app** (on an emulator/device). Everything runs on your machine.

## Prerequisites
- **Node.js 20+** (you have v22). Check: `node --version`
- **Flutter SDK** — installed at `D:\flutter`. Add to PATH: `D:\flutter\bin`
- For the app: an **Android emulator** or a phone with USB debugging (or Chrome for a quick web preview).

---

## 1. The admin panel + backend (fastest — pure browser)

### One command (recommended)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
```
This builds + starts the backend (`:3000`), starts the admin (`:3001`), and seeds a few workers awaiting VKYC review.

Then open **http://localhost:3001** and:
1. You'll land on **Officer sign-in**. Enter any name, keep the secret **`dev-admin-secret`**, sign in.
2. You'll see the **VKYC Verification Queue** with the seeded workers — liveness ✓, Aadhaar match ✓, face-match %.
3. Click **Approve** or **Reject** (with a reason). The item leaves the queue; the decision is audited.

Stop it with:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-down.ps1
```

### Manual (two terminals), if you prefer
```powershell
# Terminal 1 — backend
cd D:\heydo\apps\backend
node dist\main.js            # (run `npm run build` first if dist is missing)

# Terminal 2 — admin
cd D:\heydo\apps\admin-web
npx next start -p 3001

# Terminal 3 — seed demo workers into the queue
node D:\heydo\scripts\seed-demo.mjs
```

> The backend uses **in-memory storage** in dev, so data resets on restart. Re-run the seed script anytime to repopulate the queue.

### Optional: Postgres persistence
Local dev defaults to `PERSISTENCE=memory`. To keep VKYC sessions across backend restarts or Didit callback windows, use Postgres:

```powershell
# apps/backend/.env or repo-root .env.local
PERSISTENCE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/heydo
DATABASE_SSL=false
```

The tables must match `apps/backend/prisma/schema.prisma`. On AWS RDS, set `DATABASE_SSL=true`.

Apply the schema:

```powershell
npm run db:schema:apply
```

The command reads `DATABASE_URL` from repo-root `.env.local`, repo-root `.env`, `apps/backend/.env.local`, or `apps/backend/.env` and does not print the connection string.

---

## 2. The Flutter app (the worker/giver experience)

The app talks to the backend on `:3000`.

```powershell
$env:Path = "D:\flutter\bin;$env:Path"
cd D:\heydo\apps\mobile

flutter devices            # list emulators/devices
flutter run                # launches on the selected device
```

**Walk through:** choose **മലയാളം** → enter a phone → tap **OTP അയയ്ക്കുക** → the demo OTP shows on screen (mock SMS) → verify → pick **തൊഴിലാളി (Worker)** + name → tick consent → **വീഡിയോ പരിശോധന തുടങ്ങുക** → **പരിശോധന പൂർത്തിയാക്കുക (demo)** → you're now **"Under review"**. Approve that worker in the admin panel and pull-to-refresh status → **"Verified ✓ · can apply to gigs."**

### Networking note (important)
The app's API base is set for the **Android emulator** (`http://10.0.2.2:3000`, which maps to your PC's localhost).
- **Physical phone:** edit `apps/mobile/lib/src/api.dart` → set `baseUrl` to your PC's LAN IP (e.g. `http://192.168.1.20:3000`), and make sure the phone is on the same Wi-Fi.
- **Quick web preview (no emulator):** `flutter run -d chrome`, and set `baseUrl` to `http://localhost:3000`. (CORS may need enabling on the backend for web — fine for a quick look.)

---

## 3. The full demo loop (app + admin together)
1. Start the stack (`dev-up.ps1`) and open the admin.
2. `flutter run` the app, complete VKYC for a new worker → they appear in the admin queue.
3. Approve them in the admin → refresh status in the app → the worker is verified and can apply.

That's the Phase 1 trust loop, end to end, across both surfaces.

---

## 4. Didit webhook destination

For deployed environments, configure Didit to send webhooks to:

```text
POST https://YOUR_API_HOST/webhooks/didit
```

In Didit Business Console → API & Webhooks, create a destination with:

- Webhook version: `v3`
- Subscribed events: `status.updated`, `data.updated`
- Secret shared key: store as `DIDIT_WEBHOOK_SECRET`

The backend verifies `X-Signature-V2` first and falls back to `X-Signature-Simple`. Simple signatures only authenticate the envelope, so the backend re-fetches the final decision from Didit before changing verification state.

For gig givers/posters, create a separate Didit workflow and store it as:

```env
DIDIT_GIVER_WORKFLOW_ID=your-giver-workflow-id
```

Heydo does not run a separate admin review queue for giver identity. Didit is the review surface; Heydo ingests the final webhook/result and only allows posting when the giver verification is approved.

Local giver smoke flow:

```powershell
node scripts/didit-smoke.mjs start giver
# open the printed Didit URL and complete the giver workflow
node scripts/didit-smoke.mjs result
node scripts/didit-smoke.mjs post-gig
```

The last command should return a gig id plus its `visibilityStatus`. A normal safe gig should be `visible`; underpriced, vague, or risky gigs should go to review instead.

---

## 5. Admin safety operations

For session revocation, forced step-up, audit degraded handling, audit recovery, and lawful
escalation package flow, use:

[Admin Safety Runbook](ADMIN_SAFETY_RUNBOOK.md)

---

## Troubleshooting
- **Port already in use:** run `scripts\dev-down.ps1`, or kill stray `node` processes.
- **Admin says "Could not find a production build":** run `npx next build` inside `apps/admin-web` first (must run from that folder).
- **Queue is empty:** run `node scripts\seed-demo.mjs` (backend must be running).
- **App can't reach backend:** check the `baseUrl` note above; confirm `http://localhost:3000/health` responds.
