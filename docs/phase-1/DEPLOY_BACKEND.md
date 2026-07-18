# Backend Deployment Readiness

This is the checklist for replacing the temporary Cloudflare tunnel with a durable backend such as:

```text
https://api.heydo.in
```

## Secret-Safe Readiness Check

From the repo root:

```powershell
npm run deploy:readiness
```

The command prints only configured/missing checks. It never prints `DATABASE_URL`, `JWT_SECRET`, `PII_ENCRYPTION_KEY`, `DIDIT_API_KEY`, workflow ids, or webhook secrets.

Local dev is expected to fail this check. Production should pass it.

## Required Production Env

```env
NODE_ENV=production
PORT=3000
API_PUBLIC_URL=https://api.heydo.in
CORS_ORIGINS=https://admin.heydo.in

PERSISTENCE=postgres
DATABASE_URL=postgresql://...
DATABASE_SSL=true

JWT_SECRET=...
PII_ENCRYPTION_KEY=...
PUSH_TOKEN_ENCRYPTION_KEY=...

PUSH_PROVIDER=fcm
FIREBASE_PROJECT_ID=...
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/firebase-service-account.json

VKYC_PROVIDER=didit
DIDIT_API_KEY=...
DIDIT_WORKFLOW_ID=...
DIDIT_GIVER_WORKFLOW_ID=...
DIDIT_WEBHOOK_SECRET=...
DIDIT_CALLBACK_URL=https://api.heydo.in/verification/callback
```

FCM uses the HTTP v1 API and short-lived OAuth credentials. Keep the service-account JSON outside Git; see the [official Firebase send guide](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

## Health And Webhook URLs

Health:

```text
GET https://api.heydo.in/health
```

Didit webhook destination:

```text
POST https://api.heydo.in/webhooks/didit
```

Subscribe the Didit destination to:

- `status.updated`
- `data.updated`

## Production Gate

Do not switch Didit from the temporary tunnel to `api.heydo.in` until:

- `npm run deploy:readiness` passes in the deployment environment.
- `GET /health` returns `status=ok`.
- `npm run db:schema:apply` has been run against the production database.
- Didit worker and giver workflows complete successfully.
- A live Didit `Approved` callback persists the expected Heydo state.
- A live Didit `Declined` callback persists the expected Heydo state.
- Admin can see VKYC readiness as configured.
- A physical Android device registers an FCM token and receives a Heydo lifecycle notification.
- The service account file is outside the repo and readable only by the backend runtime.
