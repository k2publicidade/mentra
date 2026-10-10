# Online deployment: Vercel + Supabase

Local mode is unchanged: `npm start` runs `server/index.js` and the existing SQLite database. Vercel uses `api/index.js`, which imports only the online backend, never SQLite, never starts a listener, and never falls back to a local database. Online accounts are new Supabase Auth accounts; no local accounts or data are migrated.

## Required remote setup

1. Project: `mmhvbjmetsuscnyzsvxg`. Apply SQL in this order:
   - `supabase/migrations/202610090001_mentra_core.sql` **once**. The user reports applying it; that report has not been independently verified. Do not reapply it or drop existing tables.
   - `supabase/migrations/202610100001_mentra_server_undo.sql` **once, after the core schema**. This incremental migration is still required. It preserves timestamps during server undo so undo chains remain safe. Anonymous/authenticated callers cannot use the timestamp override; it requires the database `postgres` or `service_role` role. Use the Supabase SQL editor / a migration workflow; the application never auto-migrates.
2. In Supabase Authentication, enable email/password signup, choose whether email confirmation is required, and configure the Site URL to the exact canonical HTTPS application origin. Keep the standard confirmation email link (`{{ .ConfirmationURL }}`) that verifies on Supabase. Users confirm their email and then log in through the app. No browser Supabase SDK or access token from a URL is trusted by the app. Configure production SMTP and verify delivery with a real test account; provider email delivery limits are not bypassed.
3. Configure Vercel project root to this repository, Node **24.x**, build command `npm run build`, output directory `dist`. `vercel.json` routes `/api` and all `/api/*` requests to `api/index.js`; static files and SPA pages are served from the Vite output. Do not point Vercel at `server/index.js`. The repository must be supplied to Vercel by the owner; this implementation has not committed, pushed or deployed it.
4. Set the following **server-only** Vercel environment variables, then redeploy:

| Variable | Value / requirements |
| --- | --- |
| `SUPABASE_URL` | `https://mmhvbjmetsuscnyzsvxg.supabase.co` |
| `SUPABASE_ANON_KEY` | Project's legacy JWT `anon` API key, used only by the server for email/password Auth calls |
| `SUPABASE_SERVICE_ROLE_KEY` | Project's legacy JWT `service_role` key; used only for Auth account deletion |
| `DATABASE_URL` | Supabase **transaction pooler** PostgreSQL URI from the Connect panel, including its database password, host and port. Use database username `postgres.<project-ref>` for the pooler (actual PostgreSQL role `postgres`). Do not use the REST URL. Copy the exact URI and encode reserved password characters. Remove SSL query parameters (`sslmode`, `sslcert`, `sslkey`, `sslrootcert`) because TLS is enforced by the server. |
| `SESSION_SECRET` | Independent cryptographically random secret of at least 64 characters. Example generator: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Store through the deployment provider, not source control. Rotating it signs out all app cookie sessions. |
| `APP_ORIGIN` | Exact canonical `https://host` with no path, query or fragment. Used for CSRF checks, not request-derived forwarded headers. Preview deployments need their own exact origin settings; writes from a different hostname are deliberately rejected. |
| `DATABASE_CA_CERT` | Optional PEM trusted root CA from Supabase, if the default Node trust store does not verify the pooler certificate. Literal `\\n` is accepted. Never disable certificate verification. |
| `VOICE_PROVIDER`, `BRAINIALL_API_KEY` or `OPENAI_API_KEY`, `OPENAI_TRANSCRIPTION_MODEL` | Optional existing voice-provider configuration. Unconfigured voice returns a real 503, not an invented transcript. |

Never use `VITE_*` for credentials. Never put keys in `vercel.json`, browser storage or frontend code. `DB_PATH` is irrelevant to Vercel and should not be configured there.

## Behavior and transaction boundary

- Auth credentials go to Supabase GoTrue over HTTPS. Every authenticated request validates the access token with `/auth/v1/user`; decoding a JWT alone is not authentication. Expired access tokens use the provider refresh flow and the refreshed identity is verified again.
- Only access/refresh tokens are stored in an authenticated AES-256-GCM encrypted `HttpOnly; Secure; SameSite=Strict` cookie. Tokens are never returned in API JSON. The server's trusted identity determines ownership; no client-supplied owner ID is accepted.
- Registration with required confirmation returns HTTP 202, `confirmationRequired: true`, and no user/session cookie. The UI shows the email-confirmation instruction and stays logged out. Immediate-session signup returns a user only after remote identity verification and profile lookup. Registration/provider errors do not fabricate success.
- Login/logout/profile, items CRUD and filters, chat/clarification/correction/query/cancel/undo, messages, summary, JSON export, ICS calendar, integration capabilities, voice and account deletion retain the existing camelCase API contract. `mode: "local"` / `ai: "local"` describes the deterministic parser, not the persistence backend.
- PostgreSQL mutations use one checked-out connection, `BEGIN`/`COMMIT`/`ROLLBACK`, a locked owner profile row, parameterized queries and a 15-second SQL statement timeout. Chat items, conversation, two messages, undo history and idempotency response commit together. A failure rolls back the whole operation. PostgreSQL constraints additionally enforce three pending priorities. No series of independent REST calls is presented as a transaction.
- Auth account deletion calls the actual Auth admin endpoint with hard-delete semantics. Database foreign-key cascades remove all app data. A failed admin operation does not return deletion success. Auth + PostgreSQL are not a distributed transaction: if signup creates an Auth identity but a later profile lookup fails, the API returns an error and the user may retry login. It does not silently delete the newly created account.
- Local SQLite schema, local account/password/session handling, database file and default server startup are untouched.

## Verified locally vs pending online

Local tests use real PostgreSQL SQL/constraints/triggers through PGlite and real HTTP to Express. Auth protocol tests use a loopback GoTrue response fixture, not real Supabase Auth. The confirmation UI is exercised in Chromium using an explicitly mocked pending-registration response. These tests **do not prove remote Auth, email delivery, pooler TLS, deployment routing or real multi-connection PostgreSQL concurrency**.

Commands:

```sh
npm test
npm run build
npx playwright test --config playwright.online.config.js
```

Before declaring the application online, verify the deployed exact targets:

1. `/api/health` returns `{ "ok": true, "storage": "supabase" }`, not SPA HTML. This is a liveness/configuration probe, not proof of database connectivity. A missing online configuration returns 503 with no SQLite fallback.
2. Create a new account using a deliverable test email, verify confirmation email delivery/click, log in, inspect Secure/HttpOnly cookies, reload, complete onboarding. Verify no application API tokens or keys appear in browser JSON/storage.
3. Create/edit/delete/undo all item types; exercise priority overflow, impossible dates, foreign account access, chat clarification/correction/replay, logout, expiry/refresh, summary, ICS, JSON export and account deletion. Read back the actual Supabase rows and the exact deployed response after writes. Test with a second account for isolation.
4. On real PostgreSQL, issue concurrent chat requests with the same request ID and concurrent priority/undo/profile changes. Verify one idempotent result and no partial writes. PGlite is not evidence of multiple-session concurrency.
5. Test a real small voice upload with explicit external-provider consent and verify provider response/credits. Vercel function request/response payload limits can be lower than the existing 10 MB voice limit (commonly 4.5 MB); uploads above the hosting limit can be rejected before Express. Use small recordings unless a separate direct-upload architecture is introduced. No audio is persisted by this backend.

Remaining limitations: password recovery/reset is **not implemented**; do not advertise it. In-process HTTP/auth/voice limits and voice in-flight protection are per function instance, not a distributed quota; use provider/platform protection or a shared limiter for stronger abuse protection. Existing foreground browser notifications are not background delivery. WhatsApp, billing and generative AI remain unconfigured. Large JSON exports may exceed serverless payload limits for very large accounts; pagination/streamed storage is not implemented.
