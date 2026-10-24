# Security phase: configuration and manual checks

Verification update, 23 October 2026: 42 backend tests pass against a disposable MongoDB database. Production build, frontend lint (three existing warnings), 18 desktop/mobile page checks, and all three dependency audits pass. Migration functions were exercised only against test data with Cloudinary stubbed. No real database migrations, production changes, live WhatsApp connections, or live Cloudinary uploads were performed. See [SECURITY-VERIFICATION.md](SECURITY-VERIFICATION.md) for scope, fixes and deployment requirements.

## What changed

- Student/teacher management and password-request management require admin permission. The shared GET `/api/admin/profile` remains available to all authenticated roles.
- Admin profile writes require admin permission. A password change returns a renewed token for the current account page; older tokens are rejected by comparing a secret-derived credential fingerprint. Teacher/student password resets also invalidate their older sessions. No schema fields were added.
- JWTs require an explicit secret, HS256, issuer, audience, a recognized role, and a valid account ID. Existing tokens from before this phase will require login again. The session lifetime is now seven days, with authenticated renewal on reopening/returning to the portal and hourly while visible. Expired or password-revoked tokens cannot renew. See SESSION-AND-WHATSAPP-VERIFICATION.md.
- Attendance submissions validate IDs, status, real dates, duplicate entries, and eligible teacher ownership before writing or sending notifications. Existing attendance belonging to another teacher is rejected. Limit: 2,000 records per submission.
- Student notes listing and download grants are scoped to the student's class. Teachers retain the shared academy library and can delete only their own notes.
- New notes use authenticated Cloudinary storage and opaque file names. Responses no longer disclose storage URLs/IDs. Download grants last five minutes. Older public files need the separate migration below; a note missing a storage ID must be re-uploaded.
- Uploads use Multer 2.4.0, extension allowlists, byte-signature detection, multipart limits and upload rate limits. At most four upload requests are processed concurrently per server process; excess requests receive 429 with a five-second retry hint. Profiles remain limited to 5 MB; notes to 10 MB. Supported note formats include the existing PDF, Office, CSV, PNG and JPEG choices, plus TXT and supported raster formats. Text files must be valid UTF-8; Office signatures do not establish that documents are malware-free. SVG/HTML/executables are not accepted as uploads.
- JSON/URL-encoded body limits, field type/length limits, MongoDB operator-key rejection, ID and date/period validation prevent malformed inputs reaching queries. New/changed bcrypt passwords are limited to 72 UTF-8 bytes, avoiding silent truncation. Existing six-character minimum is retained.
- Helmet adds API security headers; production requires HTTPS. CORS accepts exact configured origins, with localhost defaults only outside production. Responses under `/api` have `Cache-Control: no-store`.
- Production frontend builds gain a CSP allowing local scripts, the configured API origin, Google Fonts and Cloudinary images. Inline styles remain allowed for existing React/chart styling. Development HMR is unaffected. Do not reuse a stale `client/dist` at deployment: rebuild it yourself.
- Structured JSON audit events cover mutations, admin reads, download grants and denied/error responses. They contain actor ID/role, route, status and request ID, not request bodies, passwords or tokens. Provider/database errors are logged without their potentially sensitive messages.
- New WhatsApp credential/key writes use AES-256-GCM in the existing string fields. Existing plaintext values remain readable until migrated. Wrong-key failures do not silently reset the account. Phone/name debug logs were removed from attendance dispatch.
- Demo seeding is blocked in production and requires explicit development opt-in. Default seed passwords are generated randomly unless supplied explicitly and are not printed. Previously seeded accounts are NOT automatically changed.

## Before starting

1. Use Node.js 22 or a newer supported LTS (new file detection dependency requires Node >=20). Install server dependencies with `npm ci --prefix server`. Do not run `seed` against real data.
2. Keep your existing `server/.env`; use `server/.env.example` as a reference, not as a replacement. Do not commit secrets.
3. Set `JWT_SECRET` to a random secret of at least 32 bytes. To generate one yourself:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```

4. Generate a DIFFERENT key for `WHATSAPP_AUTH_KEY`:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Save this key securely with your backups and keep it identical across app instances. Changing it without re-encrypting stored data makes encrypted WhatsApp sessions unreadable. Development can derive a temporary key from JWT_SECRET if none is supplied; use an explicit permanent key before linking accounts or migrating data.
5. Preserve MongoDB and Cloudinary credentials. For local development set `NODE_ENV=development`, `PORT=5000`, and use the frontend at `http://localhost:5173`.
6. Production needs `NODE_ENV=production`, an HTTPS reverse proxy, and an appropriate `TRUST_PROXY` configuration. `TRUST_PROXY=1` is only appropriate when exactly one trusted proxy is the only public path to Node. Prefer explicit trusted proxy addresses/subnets when known. Do not expose Node directly or blindly trust client-supplied forwarding headers. Health checks at `/api/health` are exempt from HTTPS enforcement.
7. If defaults do not match your deployment, set `CORS_ORIGINS` to exact comma-separated HTTPS origins. Set the frontend `VITE_API_BASE_URL` before building so the CSP includes the actual API origin. Rebuild whenever that origin changes.

## Manual functional checks

Start the existing backend/frontend with `npm run dev`. On a disposable database, have an admin, two teachers, and students assigned to each teacher. Use desktop and mobile.

1. Log in as all three roles. Refresh each dashboard. The old pre-change token may return 401 once: sign in again.
2. Admin: list, create, edit and delete THROWAWAY teachers/students. Upload a real profile picture. Change account details. Submit, resolve and delete a throwaway recovery request. Confirm forms and navigation behave normally.
3. Teacher: load dashboard, attendance, fee, statistics, notes and WhatsApp pages. Submit attendance for your assigned, eligible students; verify only intended notifications are sent to numbers you control. Use a historical date or disconnect WhatsApp when checking attendance without notifications. Verify edits/reset and fee payment still work.
4. Student: load dashboard, change period, and download a note belonging to the student's class.
5. Link WhatsApp with a test account, restart the server yourself, and confirm the session reconnects. Disconnect and reconnect. Confirm MongoDB credential/key values written afterward start with `enc:v1:` (inspect prefixes only; do not share credentials).
6. Change an admin password through Account: the current page should stay signed in using its renewed token. A different browser session holding the old token should get 401 on its next API request. Reset a throwaway teacher/student password as admin and confirm their old session also receives 401.

## Manual API permission and validation checks

Use browser DevTools > Network > Copy as fetch (or your API client) against your LOCAL/STAGING API. Keep bearer tokens private. Check response status and database state, not only hidden buttons. Use throwaway records for mutation checks.

| Request/check | Expected |
| --- | --- |
| GET `/api/students` without a bearer token | 401 |
| GET `/api/students`, GET `/api/teachers`, GET `/api/admin/password-requests` as student or teacher | 403 |
| Create/update/delete a throwaway student or teacher using a student/teacher token | 403; no changes |
| PUT `/api/admin/profile`, POST `/api/admin/profile/picture`, resolve/delete recovery request as non-admin | 403 |
| GET `/api/admin/profile` as any authenticated role | 200; correct role; no password/hash |
| GET `/api/teacher/dashboard` as student/admin | 403 |
| GET `/api/student/dashboard` as teacher/admin | 403 |
| POST `/api/teacher/attendance` with one valid own-student ID and one other-teacher student ID | 403; no records written or messages sent for either ID |
| Attendance with an existing other-teacher record for that student/date | 409; existing record preserved |
| Attendance with duplicate IDs, invalid status, malformed IDs, nonexistent calendar dates or >2,000 records | 400; no writes |
| POST `/api/teacher/fee/pay` with another teacher's student ID | 404; no payment written |
| GET `/api/teacher/stats/overview?studentId=<another-teachers-student-id>` | 404 |
| GET `/api/notes` as student | Only student's class; no `fileUrl`/`publicId` |
| GET `/api/notes/<different-class-note-id>/download` as student | 404; no download grant |
| Delete another teacher's note as teacher | 403 |
| GET `/api/students/not-an-id` as admin | 400 JSON |
| Send an object such as `{"$ne": null}` as studentId, identifier or an ordinary form field | 400 JSON; no mutation |
| Malformed JSON or oversized request body | 400 or 413 JSON, without stack trace |
| Invalid month/year or `viewMode` query | 400 |
| Forged/malformed/expired JWT | 401 |

For attendance API checks, the body is `{"date":"YYYY-MM-DD","records":[{"studentId":"24_HEX_ID","status":"present"}]}`. For fee payment it is `{"studentId":"24_HEX_ID","month":0,"year":2026}`; teacher months are 0–11, student dashboard months remain 1–12. Use actual valid 24-character IDs from your disposable dataset.

## Upload, rate-limit and deployment checks

- Upload legitimate files of every format you use, download them, and open them. Check teacher-owned deletion works for new and migrated notes.
- Rename a text file to `.png` and upload through an API client: expect 400. Try `.html`, `.svg` and `.exe`: expect 400. Send an oversized profile/note upload directly to the API: expect 413. Check no Cloudinary asset was created for rejected files. Browser-side size checks may intercept first, so use an API client for server limits.
- On localhost/staging only, send 11 wrong-password logins for the SAME throwaway identifier within 15 minutes. Expect 429 once 10 failed attempts have consumed the account limit. The IP login limit is 50 failed attempts per 15 minutes. Successful logins do not count after their responses finish.
- Recovery limit: 5 requests/hour/IP; sixth returns 429. Upload limit: 20/15 minutes/account; next returns 429. Authenticated API limit: 600/15 minutes/account; broad IP limit: 10,000/15 minutes to allow users sharing a centre's IP. Wait for `Retry-After` or restart local development to clear in-memory counters.
- In API response headers, check `X-Content-Type-Options: nosniff`, CSP, `Cache-Control: no-store`, `X-Request-ID` and absence of `X-Powered-By`. Check HSTS on production HTTPS responses.
- Use an API client with `Origin: https://untrusted.example` against staging: expect 403. Your configured frontend should work. A non-browser request without Origin may still reach the API; authentication/authorization must still reject unauthorized access.
- Build the frontend yourself with `npm run build --prefix client`, then check the production build. Login, charts, profile previews, Google Fonts and Cloudinary pictures should work; inspect DevTools Console for CSP violations. The meta CSP is intentionally absent from the development server. Configure frontend HTTP headers at its host too: CSP (including `frame-ancestors 'none'`), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`. API Helmet headers do not configure a separately hosted frontend.
- On staging, temporarily omit JWT_SECRET (and SESSION_SECRET): startup must fail. A JWT secret shorter than 32 bytes must fail. In production, a missing/invalid WHATSAPP_AUTH_KEY must fail. Restore configuration before proceeding. HTTP requests to non-health endpoints in production must fail; check forwarding/proxy settings if HTTPS traffic is mistakenly rejected.
- Review server logs after admin edits and failed permissions: expect `api_audit` events with actor, path, status and request ID. Ensure no passwords, JWTs, names/phone lists, QR codes or credentials appear.

## Existing data: commands YOU must run separately

Back up MongoDB and Cloudinary first. Schedule maintenance and stop app instances while moving note assets. These commands have NOT been run against real data by the agent; their migration functions were tested using an isolated database and stubbed storage operations. They update existing record values, not schemas.

```powershell
# Inventory only (no record writes):
npm run security:notes --prefix server
npm run security:whatsapp --prefix server

# Apply after reviewing inventories, backups and permanent encryption-key configuration:
npm run security:notes --prefix server -- --apply
npm run security:whatsapp --prefix server -- --apply
```

The note migration moves legacy `upload` assets to authenticated delivery, invalidates old CDN URLs, and updates existing note IDs/URLs. It can resume after an interrupted DB save. Check each failure/manual-reupload ID. For old notes lacking publicId, re-upload through the teacher UI and manually remove/invalidate the obsolete public asset in Cloudinary. Until migration completes, old public links can still bypass the portal. CDN invalidation takes time; previously downloaded copies cannot be revoked. After migration, compare downloads as authorized users with direct old/public and unsigned authenticated URLs in an incognito browser: only authorized download grants should work. Do not restore an old DB backup alone after moving assets, since it would point at obsolete IDs.

The credential migration encrypts legacy fields without printing them; it uses compare-and-set writes to avoid overwriting changed values. Re-run the inventory yourself and inspect any remaining plaintext fields. Keep WHATSAPP_AUTH_KEY with protected backups. Old backups still contain plaintext and need appropriate access/retention controls. Do not restore encrypted records without their matching key or rotate the key without a re-encryption plan.

## Remaining infrastructure / deliberate limits

- Bearer tokens remain in localStorage to preserve the existing cross-domain login flow. The production CSP reduces injection exposure but does not eliminate XSS risk. An HttpOnly-cookie + CSRF migration needs deployment/domain coordination and is not implemented here. Logout still clears the local token; it does not revoke a copied token server-side. Password changes revoke earlier tokens.
- CAPTCHA requires a provider/site key and frontend interaction; not added. Rate limiting is active without CAPTCHA.
- Rate-limit stores are in process memory and reset on restart. For multiple instances, enforce limits centrally at the gateway or use a shared Redis-backed store before treating these thresholds as cluster-wide guarantees.
- Audit events are written to stdout, not a tamper-proof database. Configure protected centralized log retention and alerting at the host.
- Upload signatures are format checks, not antivirus scanning. Configure malware scanning/quarantine for untrusted document uploads if needed. Existing downloaded documents are not retroactively scanned.
- No webhook receivers exist to add signature checks to. Require signatures when adding one.
- Database network restrictions, least-privilege database users, provider account permissions, secret rotation, backups and restore drills require account/hosting access and were not changed.
- Check and rotate/remove previously seeded default accounts yourself; the new seed guard does not secure existing credentials.
- Dependency audits were run for the root workspace, server and client on 23 October 2026; all report zero known vulnerabilities after compatible updates. Re-run audits before future releases and avoid blindly applying `--force` upgrades.
- This phase does not implement the remaining performance phases, alter routes/schemas, or certify the application as secure.
