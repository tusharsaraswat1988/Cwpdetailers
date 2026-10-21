# CWP Detailers — Customer Android App

Android mobile application for CWP Detailers and Kleansolar customers.

## Overview
A Capacitor Android shell around the customer portal (`/customer/*`). Bundles static production assets from `@workspace/cwp-platform/dist/public` and makes authenticated API calls to the CWP API server via Bearer tokens.

## Prerequisites
- Android Studio with Android SDK (API 34/35)
- Node 20+ & pnpm

## Workflow
1. Build the frontend web assets:
   ```powershell
   pnpm --filter @workspace/cwp-platform run build
   ```
2. Sync bundled assets and plugins into the Android project:
   ```powershell
   pnpm --filter @workspace/cwp-customer-app run sync
   ```
3. Open in Android Studio to build APK or run on connected device:
   ```powershell
   pnpm --filter @workspace/cwp-customer-app run open:android
   ```
