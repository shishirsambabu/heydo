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

## Run on Android

```powershell
cd D:\heydo\apps\mobile
& "$env:USERPROFILE\development\flutter\bin\flutter.bat" run `
  --dart-define=HEYDO_API_BASE=http://YOUR_PC_LAN_IP:3000 `
  --dart-define=HEYDO_FIREBASE_ENABLED=true `
  --dart-define=HEYDO_FIREBASE_API_KEY=YOUR_ANDROID_API_KEY `
  --dart-define=HEYDO_FIREBASE_APP_ID=YOUR_ANDROID_APP_ID `
  --dart-define=HEYDO_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID `
  --dart-define=HEYDO_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID `
  --dart-define=HEYDO_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
```

After OTP login, accept notification permission. The app registers the token
with Heydo, handles token rotation, updates its locale after a language change,
and refreshes the durable inbox when a foreground message arrives. Tokens are
never shown in UI or logs.

For iOS, add an app with bundle ID `in.heydo.app`, upload the APNs key in the
Firebase console, and use that app's client values in the same Dart defines.
