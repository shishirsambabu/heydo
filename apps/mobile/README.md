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

## Manual Real-Device Check

Run on a mid-range Android device before marking a phase done:

```powershell
cd apps/mobile
flutter run
```

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
