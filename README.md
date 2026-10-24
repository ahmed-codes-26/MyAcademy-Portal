# MyAcademy Portal

A tuition-center portal for administrators, teachers, and students. Built with React, Vite, Tailwind CSS, Express, MongoDB/Mongoose, and Baileys for WhatsApp.

## What it does

- **Admin:** manage students and teachers, account settings, and password requests.
- **Teacher:** attendance, monthly fees, student statistics, class study materials, private test notes, and WhatsApp alerts.
- **Student:** attendance history, fee status, and downloadable study notes grouped by subject.
- Role-specific login with renewable seven-day sessions. Password changes invalidate older sessions.
- Independent registration sequences for each teacher’s batch, starting at `00`.

## Local setup

Use Node.js 24 (tested), npm, MongoDB, and a Cloudinary account. WhatsApp linking requires a teacher account and a phone.

```sh
npm ci
npm run install:all
```

Copy `server/.env.example` to `server/.env` and fill in:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Database connection string |
| `JWT_SECRET` | A strong random secret of at least 32 bytes |
| `WHATSAPP_AUTH_KEY` | Separate base64-encoded 32-byte encryption key; required in production |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Media storage credentials |
| `CLOUDINARY_FOLDER_MODE` | `dynamic` for the current Cloudinary environment; `fixed` for legacy environments |
| `PORT` | API port; defaults to `5000` |

Keep secrets out of Git. Keep the WhatsApp key stable and backed up: changing it makes previously encrypted sessions unreadable.

```sh
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the backend at `http://localhost:5000`.

There is no public account registration. Use an existing admin account to manage accounts. The optional demo seed is restricted to disposable development databases and explicitly requires `ALLOW_DEMO_SEED=true`; it replaces sample student/attendance data. Never use it against academy data.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Frontend and API together |
| `npm run build` | Production frontend in `client/dist` |
| `npm test` | API/security/attendance/storage regression tests using disposable local MongoDB |
| `npm run lint` | Frontend lint checks |
| `npm run assets` | Optimize the source SVG and regenerate favicon PNGs/ICO |
| `npm run db:indexes --prefix server` | Add declared query indexes; does not drop existing indexes |
| `npm run storage:organize --prefix server` | Preview URL-preserving Cloudinary note folder organization |
| `npm run start --prefix server` | Production API |

Tests never load `server/.env`. They start temporary MongoDB processes; the first run downloads a MongoDB test binary. Cloudinary and WhatsApp provider calls are mocked in the tests. MongoDB replica-set support is used to verify registration migration transactions.

## Production

1. Install dependencies and build the frontend.
2. Set `NODE_ENV=production`, permanent secrets, and the correct `MONGODB_URI`/Cloudinary values.
3. Set `CORS_ORIGINS` to exact HTTPS frontend origins. Set `TRUST_PROXY` only for the actual trusted reverse proxy; production requests must arrive over HTTPS.

   For a Render web service directly behind Render's reverse proxy, set `TRUST_PROXY=1` in the backend environment. Render terminates HTTPS before forwarding to Express; this setting lets Express recognize the forwarded HTTPS connection. Without it, browser preflight requests receive `400 HTTPS is required`, which appears as a CORS error. Include `https://myacademy-portal-1.onrender.com` in `CORS_ORIGINS` if that is your frontend address (alongside any custom frontend domains you use). Reassess the trusted proxy setting if your proxy topology changes.
4. Run `npm run db:indexes --prefix server`, then start the API.

Choose one frontend hosting arrangement:

- **Separate static host:** deploy `client/dist`. Configure its SPA fallback to `index.html`, revalidate HTML, and cache fingerprinted `/assets/*` for one year with `immutable`. Enable gzip/Brotli at that host. Set `VITE_API_BASE_URL` to the API URL ending in `/api` **before building** if a same-origin `/api` proxy is unavailable.
- **Express serves both:** build first and set `SERVE_CLIENT=true` on the backend. Express serves the SPA, compresses responses, and applies immutable caching to hashed assets. Keep the same-origin `/api` default.

Private API responses and short-lived download grants are not cached. Do not configure a CDN to cache `/api/*`. Deploy the backend and frontend together. Keep old hashed static assets available during rolling deployments so already-open pages can finish lazy-loading their routes.

## Images and notes

The source logo is `client/src/assets/logo.svg`; there is no raster image embedded in it. `npm run assets` uses SVGO and generates a real 16/32/48 ICO, PNG fallbacks, and an Apple touch icon. The font is self-hosted; its license is included in `client/public/font-license.txt`.

New common profile images are auto-oriented, stripped of metadata, resized to at most 512 pixels, and stored as WebP. Image study notes use a larger 2560-pixel cap and higher quality for readable text. Animated/multipage and uncommon formats are preserved. Documents are never rasterized or recompressed. Existing public Cloudinary profile images are delivered at display size using automatic format/quality selection; originals stay intact.

New study notes are stored privately under class/subject/teacher folders. The API lists MongoDB metadata, not Cloudinary resources, and grants authorized downloads for five minutes. Existing folder organization uses Cloudinary dynamic folders so public IDs, URLs, and access types remain unchanged.

```sh
# Preview first. Apply only after reviewing the result.
npm run storage:organize --prefix server
npm run storage:organize --prefix server -- --apply
```

Folder organization does not change access protection. The eight legacy notes retain their existing public delivery mode; the separate security migration is documented in the security guide.

The apply command backs up old folder locations under `server/backups/cloudinary`. It never deletes media. Missing assets are reported for manual investigation. Registration and legacy-security migrations are separate maintenance operations; they must not run automatically on startup.

## Project layout

```text
client/
  public/          Favicon fallbacks and font license
  src/
    assets/        Source logo
    api/           HTTP client
    components/    Shared UI and connection reminders
    context/       Authentication state
    pages/         Role-specific screens, loaded on demand
    utils/         Image-delivery helpers
server/
  config/          Database, storage, and security configuration
  middleware/      Authentication, authorization, validation, uploads, limits
  models/          Mongoose models and query indexes
  routes/          API endpoints
  utils/           Attendance, registration, media, tokens, WhatsApp helpers
  scripts/         Explicit maintenance tools
  tests/           Isolated regression tests and real format fixtures
scripts/           Reproducible favicon generation
docs/             Feature, security, registration, and performance guides
```

Dependencies, build outputs, test caches, secrets, and private maintenance backups are excluded from Git. Keep the backups; do not treat them as disposable build files.

## Further details

- [Performance audit, measurements, and cleanup](docs/PERFORMANCE-AUDIT.md)
- [Security configuration and deployment](docs/SECURITY-HANDOFF.md)
- [Registration format and reassignment](docs/REGISTRATION-NUMBERING.md)
- [Sessions and WhatsApp reminders](docs/SESSION-AND-WHATSAPP-VERIFICATION.md)
- [Portal features and manual checks](docs/PORTAL-FEATURES-VERIFICATION.md)
