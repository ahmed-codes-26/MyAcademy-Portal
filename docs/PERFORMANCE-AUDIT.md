# Performance and cleanup audit

Completed October 24, 2026. The actual stack is React/Vite/Tailwind, Express, Mongoose, and Baileys. There are no EJS views, Tailwind CDN, or Chart.js files to optimize.

## Measurements

| Measure | Before | After |
| --- | ---: | ---: |
| Initial JavaScript entry | 808,193 bytes | 301,210 bytes (62.7% smaller) |
| Entry gzip estimate | approximately 230.9 KB | 97.2 KB |
| Branding files, including favicon fallbacks | 366,235 bytes | 39,476 bytes (89.2% smaller) |
| 512 px favicon | 190,671 bytes | 13,301 bytes |
| Shared source logo | Multiple raster sizes | 4,742-byte SVG; approximately 1,884 bytes gzip |

The initial entry is smaller because other role pages and Recharts load on demand, not because features were removed. A chart page downloads its chart chunks once, then fingerprinted assets can be reused from cache.

Local Chrome login delivered **98,369 encoded JavaScript bytes**. It requested neither chart/dashboard chunks nor external Google font servers. Desktop and mobile samples both recorded **CLS 0**. These are local observations, not public-hosting or Lighthouse claims.

### Local API timing sample

Fixture: 39 students, 1,755 attendance records, eight notes, disposable local MongoDB. Eight warm requests per route after one warm-up; includes response parsing. No trustworthy before-baseline for production latency was captured.

| Route | Median | 95th percentile |
| --- | ---: | ---: |
| `/api/teacher/dashboard` | 14.40 ms | 22.96 ms |
| `/api/student/dashboard` | 13.70 ms | 20.18 ms |
| `/api/teacher/stats/class?month=9&year=2026` | 16.86 ms | 17.97 ms |
| `/api/teacher/fee?month=9&year=2026` | 6.96 ms | 7.97 ms |
| `/api/notes` | 7.25 ms | 7.70 ms |

## Findings and changes, biggest wins first

1. **All pages/charts loaded at login.** Added route-level lazy loading, preserving all routes and features. Login, notes, attendance, and account screens no longer need the chart library up front.
2. **Compression and caching depended on hosting.** Added gzip/Brotli response compression. Optional Express SPA hosting caches hashed assets for a year with immutable caching and revalidates HTML. Private APIs remain no-store. Separate static hosts need the equivalent rules configured there.
3. **Redundant raster branding and external font requests.** Traced the existing flat logo into a pure-path SVG, optimized with SVGO, and reused one hashed asset. Regenerated the real ICO and PNG fallbacks. Self-hosted the original font family/weight range and preloaded the logo/font. Above-the-fold images remain eager and dimensioned.
4. **Full-resolution image uploads/delivery.** Common profile uploads become auto-oriented, metadata-stripped WebP at most 512 px. Existing unsigned Cloudinary avatars use display-sized automatic quality/format delivery. Signed/private/preview URLs are preserved.
5. **Unstructured media storage and orphan risk.** New image notes use a larger 2560 px cap and higher quality. Documents and animated/multipage/uncommon images are preserved. Notes use class/subject/teacher folders with UUID IDs and readable display names. Failed metadata creation cleans up the new upload. Failed provider deletion retains the note for retry.
6. **Repeated DB reads and missing indexes.** Added student/teacher/enrollment/name, teacher/date attendance, teacher/fee-period, and class/sort note indexes. Independent dashboard queries run concurrently with narrow projections. Student all-time streaks reuse the summary query results. Read-only attendance/notes reads use lean objects where safe.
7. **Connection and repository overhead.** Reuse one Mongoose connection attempt, with a 20-connection pool and finite idle/queue timeouts. Retained upload capacity limits. Extracted context hooks from provider components, resolving lint warnings. Removed unused starter assets, moved handoff reports into docs, and rewrote README.
8. **Dependency advisory.** Applied the compatible Multer 2.5 patch for its reported upload teardown denial-of-service vulnerability. Root, frontend, and backend npm audits returned zero known vulnerabilities afterward.

## Project map

| Area | Files / routes |
| --- | --- |
| Admin UI | DashboardPage and AccountPage: `/`, `/account` |
| Teacher UI | Dashboard, attendance, fee, stats, study notes, test notes, WhatsApp under `/teacher/*` |
| Student UI | StudentDashboardPage: `/student/dashboard` |
| Shared frontend | `client/src/components`, `context`, `api`, `utils` |
| Branding | `client/src/assets/logo.svg`; favicon fallbacks in `client/public` |
| API | `server/app.js`, `server/server.js`, and auth/admin/students/teachers/teacher/student/notes/testNotes/whatsapp routers |
| Middleware | Authentication, roles, validation, upload checking/optimization, limits, auditing |
| Database | `server/models`; original unique identity/payment/attendance indexes retained |
| Maintenance / tests | `server/scripts`, `server/tests`, document-format fixtures |
| Documentation | README plus `docs/` |

## Complete original public-asset inventory

Sizes are on disk, before HTTP compression. Every asset present at the beginning of this pass is listed.

| File | Before bytes | After bytes | Action |
| --- | ---: | ---: | --- |
| `apple-touch-icon.png` | 26,911 | 5,997 | Regenerated from SVG |
| `favicon-512.png` | 190,671 | 13,301 | Regenerated from SVG |
| `favicon.ico` | 6,436 | 4,398 | Regenerated from SVG |
| `favicon.png` | 29,964 | 6,296 | Regenerated from SVG |
| `favicon.svg` | 9,522 | 4,742 | Replaced unrelated starter favicon with academy SVG |
| `icons.svg` | 5,031 | — | Deleted unused starter sprite |
| `logo-110.webp` | 7,526 | — | Deleted; replaced by shared SVG |
| `logo-142.webp` | 10,830 | — | Deleted; replaced by shared SVG |
| `logo-220.webp` | 22,032 | — | Deleted; replaced by shared SVG |
| `logo-284.webp` | 39,484 | — | Deleted; replaced by shared SVG |
| `logo-30.webp` | 1,332 | — | Deleted; replaced by shared SVG |
| `logo-34.webp` | 1,570 | — | Deleted; replaced by shared SVG |
| `logo-42.webp` | 2,120 | — | Deleted; replaced by shared SVG |
| `logo-60.webp` | 3,428 | — | Deleted; replaced by shared SVG |
| `logo-68.webp` | 4,024 | — | Deleted; replaced by shared SVG |
| `logo-84.webp` | 5,354 | — | Deleted; replaced by shared SVG |

New source: `client/src/assets/logo.svg`, 4,742 bytes. Local Latin WOFF2: 34,704 bytes, with its required font license included. SVG contains paths, not an embedded raster. Original white-background treatment is preserved. ICO decoded as actual ICO with 16/32/48 images; PNG sizes verified as 192, 512, and 180.

**Deleted:** ten old `logo-*.webp` assets and unused `client/public/icons.svg`, after checking code references. The unrelated starter `favicon.svg` was replaced. Five root handoff/verification guides moved into docs. No active source directories, notes, student records, or maintenance backups were deleted. Dependencies, build output and cached MongoDB test binaries are used and retained.

## Applied Cloudinary/database work

Eight existing notes were organized using the verified dynamic-folder environment's `asset_folder` setting. Public IDs, file URLs, file contents, and delivery types were unchanged. A second preview reported zero pending moves and zero missing assets. Readable names were applied in the media library.

Backup: `server/backups/cloudinary/folders-1792838713496.json` (folder mapping, not a full media backup). The old `myacademy_notes` folder remains because it still contains other assets/subfolders. Unverified files and provider backups were not deleted.

**Access-mode finding:** those eight legacy notes retain public `upload` delivery. Folder labels do not make media private. New note uploads use authenticated delivery. Changing legacy public URLs is the separate security migration documented in SECURITY-HANDOFF.md; this performance pass did not invalidate them silently.

Additive query indexes were created on the configured academy database. No existing indexes were dropped and no registration, attendance, payment, or billing fields were rewritten.

## Verification

- Full suite: **70 tests passed**; final targeted upload/Brotli checks also passed.
- Production build passed; frontend lint passed with **zero warnings**.
- All three npm audits reported zero known vulnerabilities.
- All **18** role/page/viewport browser navigations passed with no JavaScript errors, CSP violations or failed API calls. Password-change renewal survived reload.
- Direct Express SPA hosting verified: compression/security headers, deferred chart code, local fonts/SVG, and zero observed login layout shift on desktop/mobile.
- Checked image alpha/orientation/resize/metadata, signed avatar URL preservation, document signatures, private download authorization, safe storage failure handling, folder preview/idempotence, gzip/Brotli and caching behavior.
- `git diff --check` passed; private backups remain ignored by Git.

Before/after byte inventories, screenshots, and timing data are in the task artifact directory:
`C:/Users/ahmed/.codex/visualizations/2026/10/18/01a14df2-9ad1-7880-ae25-4c2110a79e90/performance/`.

## Deliberate limits

No deployment/push, production Lighthouse comparison, or guaranteed public-site response time is claimed. Runtime changes need deployment; indexes and the eight folder moves are already applied.

No dashboard cache was added that could make newly saved fees/attendance look stale. Existing list/pagination behavior was preserved. Existing photo originals remain available, while smaller delivery variants improve loading. PDFs/Office files and animated/multipage media were not destructively recompressed. Unverified Cloudinary leftovers and backups were retained.

Separate frontend hosts must set compression, HTML revalidation and immutable hashed-asset caching themselves. Express supplies those headers with SERVE_CLIENT=true. Keep earlier hashed assets during rolling deployments so already-open pages can finish loading routes.

## Manual checks after deployment

1. Open login on desktop/mobile: check branding, favicon and stable layout. Network should show no chart chunks or external Google fonts before login.
2. Visit every role's pages, including attendance date selection/save/edit/reset, fees, statistics, both notes sections, account and WhatsApp. Check for missing lazy chunks or CSP errors.
3. Upload a representative profile photo and check orientation/sharpness, including transparency if used. Verify existing photos still render.
4. Upload/download a study image and a PDF/Office file. Confirm readable images, unchanged document contents, class restrictions, and organized Cloudinary folders.
5. Confirm compressed immutable hashed assets, revalidated HTML and no-store authenticated APIs. Review the separate legacy-media security migration before applying it.

References: [Cloudinary folder modes](https://cloudinary.com/documentation/folder_modes), [media access](https://cloudinary.com/documentation/control_access_to_media), [Sharp output](https://sharp.pixelplumbing.com/api-output/), [Multer advisory](https://github.com/advisories/GHSA-q7qp-rjg7-q26m).
