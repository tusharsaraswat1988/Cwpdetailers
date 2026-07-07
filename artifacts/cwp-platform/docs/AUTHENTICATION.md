# CWP Authentication — Developer Guide

Architecture reference for the customer authentication module (`artifacts/cwp-platform` + `artifacts/api-server`).

## Flow Overview

```
/login or /register
    ├── Google → POST /api/auth/google → (existing) confirm dialog | (new) phone link
    ├── Mobile → POST /api/auth/otp/send → OTP overlay (dialog/sheet)
    │              └── POST /api/auth/otp/verify → session issued
    └── Password (login only) → POST /api/auth/login
```

OTP verification uses an **in-page overlay** (`AuthOtpOverlay`), not navigation. `/verify-otp` is an internal redirect shim only.

## Component Hierarchy

```
AuthLayout
├── AuthHeader / AuthFooter / AuthDivider
├── GoogleButton → useAuthFlow.handleGoogleToken
├── Phone form → useSendAuthOtp → useAuthFlowStore.setOtpSession
├── AuthOtpOverlay
│   └── OTPVerification
├── PasswordLogin (login only, expandable)
└── AuthGoogleDialogs
    ├── GoogleAccountFoundDialog (existing account — user must confirm)
    └── GooglePhoneLinkDialog (new Google user — phone verification)
```

## State Management

| Layer | Purpose |
|-------|---------|
| `useAuthFlowStore` (Zustand, in-memory) | OTP session between form and overlay |
| `useAuthFlow(portal)` | Google auth, redirects, portal role checks |
| `useAuth()` | Persisted session (localStorage + httpOnly cookie) |
| `rememberPhone.ts` | Optional device-local phone hint `{ phone, savedAt }` |

## API Interactions

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/otp/send` | Send SMS OTP (`purpose: login \| signup`) |
| `POST /api/auth/otp/verify` | Verify OTP, issue session |
| `POST /api/auth/login` | Password login |
| `POST /api/auth/google` | Google ID token exchange |
| `POST /api/auth/google/complete` | Link phone to new Google signup |
| `POST /api/auth/forgot-password` | Reset OTP |
| `POST /api/auth/reset-password` | Set new password with OTP |
| `POST /api/auth/set-password` | Logged-in password create/change |
| `POST /api/auth/logout` | Revoke sessions |

**Removed:** `POST /api/auth/phone/check` — do not reintroduce pre-OTP existence checks (enumeration + latency).

## Security Assumptions

### Account enumeration

- OTP send errors are **neutralized** server-side (`neutralizeOtpSendError`) and client-side (`authErrorMessages.ts`).
- Never display "account exists" / "account not found" before OTP ownership proof.
- Generic links ("Create account", "Sign in") remain on pages — not error-triggered.

### Rate limiting

| Layer | Mechanism |
|-------|-----------|
| Per phone | `authOtp.ts` — max 5 OTPs/hour per phone+purpose |
| Per IP + phone | `authRateLimit` middleware on `/auth/otp/send` and `/auth/otp/verify` |
| Future | Redis-backed limits for multi-instance; per-device fingerprint |

### Session cookies

- `httpOnly`, `secure` (production), `sameSite: lax`
- Portal-scoped: `cwp_session_customer`, `cwp_session_staff`, etc.
- 30-day rolling TTL; extended on `/api/auth/me` activity
- Bearer token also stored in localStorage per portal (legacy mobile/PWA support)

### CORS

- `cors({ origin: true, credentials: true })` — credentials required for cookies

### CSRF

- Session cookies use `SameSite=Lax`; state-changing auth endpoints accept JSON POST with bearer/cookie auth
- No separate CSRF token today — document if adding cookie-only form posts

### Password policy

- Minimum 6 characters (`validateNewPassword`)
- No maximum enforced; paste and password managers supported via standard `autocomplete`
- Optional post-login password via Profile → Security

## Session Management (Current)

| Feature | Status |
|---------|--------|
| Multiple devices | ✅ Each login creates new session row |
| Logout | ✅ Revokes current session + clears cookies |
| Logout all devices | ⚠️ Only on password reset (revokeAllUserSessions) |
| Expired sessions | ✅ Rejected at middleware |
| Refresh token rotation | ❌ Not implemented — opaque token, 30-day TTL |
| Idle timeout | ❌ Not implemented — rolling extend on activity |
| Remember device | ✅ Optional phone hint only (not a session) |

## Observability

Structured logs via `logAuthEvent()` in `authObservability.ts`:

- `auth.otp.send` / `auth.otp.send.failed`
- `auth.otp.verify` / `auth.otp.verify.failed`

**Never logs:** OTP codes, passwords, raw tokens.

Wire production log aggregation to filter on `event` field.

## Analytics

Frontend funnel events via `trackAuthEvent()` in `authAnalytics.ts`:

- `registration_started`, `otp_sent`, `otp_verified`, `registration_completed`
- `login_completed`, `google_started`, `google_success`, `google_cancelled`, `password_login`

Subscribe with `onAuthEvent()` to connect GA4/Mixpanel.

## Technical Debt / Future Improvements

### 1. Unified OTP send (no `purpose` upfront)

**Target:** Send OTP regardless of account existence; determine login vs signup at verify time (PhonePe/Swiggy pattern).

**Today:** Backend requires `purpose: login | signup` before sending. Neutral errors prevent enumeration but SMS is still not sent for mismatched purpose.

**Migration:** Add `POST /api/auth/otp/send-unified` returning `{ sent: true }` always when SMS configured; verify endpoint creates or logs in user.

### 2. Google deferred session issuance

**Today:** `POST /api/auth/google` issues session immediately for existing users; frontend delays `login()` until user confirms in `GoogleAccountFoundDialog`.

**Target:** Support `confirmRequired=true` or `preview=true` on Google auth — return account hint without token until confirmed.

### 3. Distributed rate limiting

Replace in-memory `authRateLimit` with Redis for horizontal scaling.

### 4. Portal reuse

`useAuthFlow(portal)` supports `customer | staff | admin | franchisee`. Only redirect map differs per portal — reuse components for staff/admin when needed.

## Testing

```bash
cd artifacts/cwp-platform
pnpm test:auth
```

Covers: error mapping, remember-phone storage, phone validation helpers.

## File Index

| Path | Role |
|------|------|
| `src/pages/Login.tsx` | Customer login |
| `src/pages/Register.tsx` | Customer registration |
| `src/components/auth/*` | Reusable auth UI |
| `src/lib/authFlowStore.ts` | OTP session state |
| `src/lib/authErrorMessages.ts` | Neutral error copy |
| `src/lib/authAnalytics.ts` | Funnel events |
| `src/lib/rememberPhone.ts` | Device phone hint |
| `src/hooks/useAuthFlow.ts` | Shared auth logic |
| `api-server/src/routes/auth.ts` | Auth API routes |
| `api-server/src/lib/authOtp.ts` | OTP send/verify |
| `api-server/src/lib/authObservability.ts` | Structured logging |
| `api-server/src/lib/authRateLimit.ts` | IP+phone rate limits |
