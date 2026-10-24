# Security verification — 23 October 2026

The local checks pass. The changes can be pushed for review, but live deployment still requires configuration and real-provider staging checks below. No production data or provider accounts were changed.

## Results

| Check | Result |
| --- | --- |
| Backend suite | 42 passed; zero failed/skipped |
| Database | Actual disposable MongoDB 7.0.24 process; real Mongoose queries, unique indexes and bcrypt |
| Frontend production build | Pass; existing large-JS-chunk warning remains (~796 KB uncompressed) |
| Frontend lint | Exit 0; three existing warnings: two Fast Refresh export warnings and one unused import |
| Browser checks | 18 authenticated page checks: nine routes on desktop 1440×1000/1× and mobile 390×844/2× |
| Browser errors | No page JavaScript errors, unexpected API errors or CSP violations |
| Account password UI | Renewed token retained; account page survives reload after saving |
| Dependency audits | Root: 0; server: 0; client: 0 known vulnerabilities |
| Dependency trees | `npm ls --depth=0` succeeds in all three workspaces |
| Patch hygiene | `git diff --check` passes; test database binary/cache is ignored by Git |
| Runtime used | Windows, Node.js 24.21.0 |

The suite covers all three roles, anonymous/forged/expired tokens, shared profile responses, protected management operations, account creation/update/deletion, password-reset session invalidation, teacher-owned attendance/fee/statistics queries, mixed/future rosters rejected without writes, attendance submit/edit/reset, class-scoped notes, signed-download grant parameters, private-upload options and authorized deletion, multipart PNG/PDF/DOCX/XLSX/PPTX/CSV detection, fake/unsupported/oversize uploads, JSON/body limits, CORS, HTTPS forwarding and untrusted-proxy spoofing, rate limits, WhatsApp credential persistence/encryption/tamper rejection, fail-closed startup configuration, migration dry-runs, repeat runs and recovery after a storage move followed by a failed database save.

## Issues found and corrected during verification

1. **The backend tests could not start without production secrets.** Added a test-only bootstrap that generates ephemeral credentials and never reads `.env`. It connects only to the disposable database. Application creation now lives in `server/app.js`; `server/server.js` retains normal dotenv/database/listen startup. Importing the application is also tested without provider stubs to catch dependency-loading regressions.
2. **Student fee display did not match recorded teacher payments.** The dashboard queried 1–12 months against a collection storing 0–11, used nonexistent `amount`/`paidAt` fields, and sent `SUBMITTED` to a UI expecting `PAID`. It now uses the stored month convention, the student's fee amount, the payment update timestamp and the existing UI's PAID/PENDING values. January, December and pending-record cases are tested. No schemas changed.
3. **Saving an admin profile dropped its role from frontend state.** The update response now includes `role: 'admin'`, preserving protected-route access. Verified by API tests and the actual account page password-change/reload flow.
4. **Dependency advisories were present in all three lockfiles.** Applied compatible updates, including Express/proxy dependencies, Axios and Vite. No forced major upgrades or suggested legacy downgrades were used. Replaced Nodemon with Node's built-in watch mode to remove its vulnerable development dependency chain. `npm run dev` and `npm run server` remain the commands to use.

## Re-run locally

```powershell
npm ci
npm ci --prefix server
npm ci --prefix client
npm test --prefix server
npm run build --prefix client
npm run lint --prefix client
npm audit
npm audit --prefix server
npm audit --prefix client
```

Tests do not need your real database or secrets. The first run needs network access to download a platform-specific MongoDB binary, which can be large on Windows. It is cached under ignored `server/.cache/mongodb-binaries` so subsequent installs do not remove it. The test runner uses the alternate official `downloads.mongodb.org` hostname because this environment reset connections to `fastdl.mongodb.org`. An installed compatible binary can also be selected through the memory-server package's `MONGOMS_SYSTEM_BINARY` environment variable. Use Node.js 24 LTS to match this verification runtime.

Provider boundaries are deliberately stubbed in automated integration tests: Cloudinary upload/delete/rename/resource operations and WhatsApp sockets never reach real accounts. Credential serialization and encryption are real. Browser checks use the compiled frontend, actual local API and disposable database; non-local requests, including Google Fonts, are blocked. They verify application logic/CSP enforcement rather than real-provider delivery or font availability. Browser automation was run with local Chrome through the available automation runtime; the portable backend regression suite and fixtures are included in the repository.

## Required before live deployment

1. **Set a permanent `WHATSAPP_AUTH_KEY` in deployment secrets before linking/migrating sessions.** The local `server/.env` currently has no such key. Its JWT secret meets the length minimum; secret values were not printed or changed. A development-derived key must not be replaced after encrypting real sessions without a re-encryption plan. Host/deployment variables were not inspected.
2. **Configure HTTPS and the actual trusted proxy.** Local `server/.env` has no `TRUST_PROXY`, which is normal for development. Configure production's trusted proxy/network and restrict direct access to Node. Verify production HTTPS requests reach authenticated routes successfully; the tests cannot certify the hosting network.
3. **Configure the real frontend origin and API base URL.** Set production CORS origins and `VITE_API_BASE_URL` (or the host's `/api` proxy/rewrite) before building. Deploy the newly generated build; `client/dist` is ignored and is not part of a Git push. Configure frontend host security headers as described in the handoff.
4. **Back up data and migrate existing assets/credentials deliberately.** Use the inventory/apply commands in `SECURITY-HANDOFF.md` during maintenance. They have not been run on your real database. Existing public Cloudinary links remain public until successfully migrated and invalidated; old downloaded copies cannot be revoked.
5. **Run real-provider checks in staging.** Upload/download/delete a new private note and a migrated note, verify unauthorized/direct links fail, scan WhatsApp with a test account, restart/reconnect, and send an attendance alert only to a number you control. Test Google Fonts/network delivery on the deployed frontend. Provider permissions and service behavior cannot be established by stubs.
6. **Plan the one-time login reset.** Old JWTs must be replaced by signing in after deployment. Keep the WhatsApp encryption key stable across instances and backups. Use a maintenance window to avoid mixed old/new application versions and credential formats.

Retained limits: localStorage bearer tokens, local-only logout, in-process rate-limit stores, stdout audit retention, no CAPTCHA provider and no document antivirus service. See the handoff for details and infrastructure follow-ups. Passing checks and a clean advisory audit do not certify the application as free of security defects.
