# Firebase Messaging Setup

Heydo's Firebase client is disabled by default. It starts only after successful
Heydo authentication and only when `HEYDO_FIREBASE_ENABLED=true` is supplied.

## Firebase console

1. Create or select the Heydo Firebase project.
2. Add an Android app with package name `in.heydo.app`.
3. In Project settings, copy the Android app's API key, app ID, messaging sender
   ID, project ID, and optional storage bucket.
4. Enable Cloud Messaging API (HTTP v1).
5. Configure the backend service account as documented in `.env.example`. Keep
   that service-account JSON outside this repository.

The Firebase client identifiers below are application configuration, not the
backend service-account credential. Do not put private keys in Dart defines.

## Prepare local configuration

Create the gitignored configuration file:

```powershell
cd D:\heydo
npm run firebase:readiness -- init
```

Fill `apps/mobile/firebase.local.json` with the Android app values. Then add the
backend values to `D:\heydo\.env.local`:

```dotenv
PUSH_PROVIDER=fcm
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:\path\outside\the\repo\service-account.json
```

Validate both sides without printing any identifiers or credentials:

```powershell
npm run firebase:readiness
```

## Run on Android

```powershell
cd D:\heydo\apps\mobile
& "$env:USERPROFILE\development\flutter\bin\flutter.bat" run `
  --dart-define-from-file=firebase.local.json `
  --dart-define=HEYDO_API_BASE=http://YOUR_PC_LAN_IP:3000
```

After OTP login, accept notification permission. The app registers the token
with Heydo, handles token rotation, updates its locale after a language change,
and refreshes the durable inbox when a foreground message arrives. Tokens are
never shown in UI or logs.

For iOS, add an app with bundle ID `in.heydo.app`, upload the APNs key in the
Firebase console, and use that app's client values in the same Dart defines.
