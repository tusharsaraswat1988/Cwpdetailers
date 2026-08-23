# CWP Staff — Android app

Field app for punch, GPS-verified jobs, and photo uploads. Customer booking stays on the website/PWA.

## What this package is

A Capacitor Android shell around the existing staff portal (`/staff/login`). Native GPS + camera run inside that WebView. The APK does not open customer or admin screens.

## One-time setup

Install Android Studio (SDK + a phone or emulator). From this folder, only if `android/` is missing:

```powershell
pnpm exec cap add android
```

(Already done in this repo.)

## Daily / device testing

Point the WebView at your running Vite app (phone and PC on the same Wi‑Fi). In repo-root `.env`:

```
STAFF_APP_SERVER_URL=http://YOUR_LAN_IP:21456
```

Then:

```powershell
pnpm --filter @workspace/cwp-staff-app exec cap sync android
pnpm --filter @workspace/cwp-staff-app exec cap open android
```

Run from Android Studio onto a staff phone. Allow **Precise location** and camera.

## Production APK

Set `STAFF_APP_SERVER_URL` to the live site origin (the app appends `/staff/login`). Sync, then Build → Generate Signed Bundle / APK. Ship first on **Play Internal testing**, not the public store.

## Field behaviour

- Punch: native front camera + GPS accuracy wait (target ±50m, reject >200m)
- Jobs / daily clean: native rear camera; photos and punch queue on the phone if 4G drops
- Pending uploads show as an amber banner in the staff shell
