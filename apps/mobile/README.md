# Heydo Mobile

Flutter app for Heydo workers and gig givers. This is the primary product surface for VKYC, gig posting, worker applications, safety reporting, and Malayalam-first marketplace flows.

## QA Gate

From the repo root:

```powershell
npm run mobile:qa
```

This runs:

- `flutter --version`
- `flutter pub get`
- `flutter analyze`
- `flutter test`

Optional debug APK build:

```powershell
$env:HEYDO_MOBILE_BUILD="1"
npm run mobile:qa
```

The command intentionally fails when Flutter is not installed or not on `PATH`. Install Flutter 3.22+ and Android tooling before closing the mobile QA gate.

### Windows Tooling Setup

From the repo root:

```powershell
npm run mobile:setup:windows
```

Then open a new PowerShell window and run:

```powershell
npm run mobile:qa
```

## Manual Real-Device Check

Before the phone run, check that Firebase, backend health, and a real Android
phone are all ready:

```powershell
cd D:\heydo
$env:HEYDO_API_BASE="http://YOUR_PC_LAN_IP:3000"
npm run mobile:device:qa
```

Run on a mid-range Android device before marking a phase done:

```powershell
cd apps/mobile
flutter run --dart-define-from-file=firebase.local.json --dart-define=HEYDO_API_BASE=http://YOUR_PC_LAN_IP:3000
```

Use your PC's LAN IP when testing on a physical Android phone. For the Android emulator, omit the dart define; the app defaults to `http://10.0.2.2:3000`.

Verify:

- Malayalam strings render correctly.
- Worker VKYC can start and return to status.
- Giver VKYC can start and return to status.
- Unverified giver cannot post.
- Approved giver can post a safe gig.
- Underpriced/risky gig goes to admin review.
- Verified worker can browse and apply.
- Worker can submit a safety report from a gig.
- No text overflows on small screens.
- App still behaves predictably after network interruption and restart.

## Backend

The mobile app expects the backend API to be running locally unless configured otherwise:

```powershell
cd D:\heydo
npm run start:backend
```
