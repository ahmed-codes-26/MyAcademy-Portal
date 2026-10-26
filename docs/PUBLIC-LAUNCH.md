# Public homepage and first-domain launch

Canonical origin: `https://myacademy.ahmedcodes.pro`. This is a first launch; no domain migration or old-domain redirect is involved. Nothing was deployed by this implementation.

## Implementation

- `/` is a public, build-time-rendered React homepage. The same component is hydrated in the browser. Text, role descriptions, FAQs, links, and the initial teacher screenshot are in the initial HTML. No API, database, account, or storage information is read during prerendering.
- Administrator dashboard moved from `/` to `/admin/dashboard`; its login redirect, navbar, and account back link were updated. Teacher/student routes remain unchanged. `/login?role=student|teacher|admin` preselects the existing login panel. Recovery remains inside `/login`.
- A stored-session shortcut on the homepage points to `/portal`, which validates the session through the existing auth provider before selecting the correct dashboard. The homepage itself never redirects signed-in visitors.
- Public and portal documents are separate. Full-document links to the portal unload the homepage analytics code. No private data is included in either static document. API and note-download authorization remain in place.
- Build output includes canonical/social metadata, WebSite and SoftwareApplication JSON-LD, a 1200×630 PNG sharing image, robots.txt, and a one-URL sitemap. Existing favicon assets are retained. Regenerate the sharing image with `node scripts/generate-social.cjs`.
- robots.txt permits public crawling, including Googlebot, Bingbot, and OAI-SearchBot. No existing GPTBot-specific preference was found; none was introduced. Login pages remain crawlable so crawlers can read noindex.
- No external contact/profile link was verified, so none was invented. Accounts are created by academy administrators; there is no public registration.

## Environment variables

Set frontend variables in the build host's environment (or `client/.env.production` locally), **before** `npm run build`. See `client/.env.example`.

| Variable | Production | Preview/staging |
| --- | --- | --- |
| `VITE_PUBLIC_INDEXING` | `true` for the canonical-domain artifact | Leave unset or `false`; defaults to noindex |
| `VITE_GA_MEASUREMENT_ID` | Optional `G-…` GA4 ID | Leave unset |
| `VITE_API_BASE_URL` | `/api` for same-origin serving; otherwise the existing API origin ending in `/api` | Appropriate staging API |

Existing backend credentials are unchanged. With Express serving the site, use `SERVE_CLIENT=true`, `NODE_ENV=production`, exact `CORS_ORIGINS` including `https://myacademy.ahmedcodes.pro`, and `TRUST_PROXY` matching the actual reverse proxy topology (for the existing direct Render proxy, `1`). Never expose the backend directly while trusting arbitrary forwarded headers. The proxy must preserve the requested host and overwrite forwarded headers.

## Hosting requirements

### Express (implemented and tested)

Build the frontend, deploy backend and frontend together, and set `SERVE_CLIENT=true`. Express serves `/` from index.html, only routes in `client/portal-routes.json` from portal.html, and unknown frontend paths from 404.html with HTTP 404. Static assets remain available and hashed assets keep immutable caching. HTML revalidates; API cache behavior is unchanged.

Express adds `X-Robots-Tag: noindex, follow` on nonproduction hosts and on nonpublic routes. The production build flag also controls the HTML robots directive. Both the build flag and deployment environment must be correct for indexing. Preview builds must remain separate artifacts; do not reuse an indexable production artifact on a static preview host without a host-level noindex header.

### Separate static host (requires host configuration)

Deploy `client/dist`. **Remove the old catch-all rewrite to index.html.** Configure these rules:

1. `/` serves index.html with 200.
2. Every exact path in `client/portal-routes.json` rewrites to portal.html with 200. Queries such as `?role=teacher` must be preserved. Do not use `/teacher/*` or another wildcard.
3. Existing assets, robots.txt and sitemap.xml are served directly.
4. All other URLs serve 404.html with status 404, not a 200 SPA fallback.
5. Staging/preview hosts apply `X-Robots-Tag: noindex, follow` globally and use a noindex build. Login and private routes should also carry that header; portal.html already includes the meta directive.
6. Keep HTTPS, compression, HTML revalidation, immutable fingerprinted asset caching, and the existing `/api` proxy or frontend API base URL.

The repository does not identify a configured static-host project. Its rewrite/header settings cannot be changed or verified from this checkout. The smallest alternative when a static host cannot supply real 404s or preview headers is the existing Express `SERVE_CLIENT=true` arrangement, not a framework migration. `vite preview` is not a production routing verification server.

## Optional GA4

Without a valid ID, no Google script loads and no analytics UI is displayed. With an ID, the homepage offers Allow analytics / No thanks. Permission lasts for that document only; it is intentionally not persisted. Turning analytics off reloads the page without the Google script. No existing consent system was found. If one is added later, integrate its decision using `window.myAcademyAnalyticsConsent = true` before initialization or the `myacademy:analytics-consent` CustomEvent with boolean detail, and replace the small built-in prompt.

Analytics only initializes on the exact production origin at `/`, after opt-in. It sends one manual `page_view` per document and a `portal_access` event per access-link click. Only fixed placement and role values are sent. Location is always the canonical homepage without queries/fragments. Referrer is reduced to its origin; no referring path/query is sent. There are no user IDs, names, emails, registration numbers, tokens, dashboard URLs, or form values. Google signals and ad-personalization signals are disabled.

Before enabling the ID, turn **Enhanced measurement off** for this web stream, particularly automatic history-based page views and form interactions. Keep this stream free of additional tags that automatically collect URLs or form content. Manual pageview configuration is described in [Google's pageview documentation](https://developers.google.com/analytics/devguides/collection/ga4/views).

After authorized deployment:

1. Use a clean browser session on the canonical homepage. Before consent, verify no Google tag/collect requests. Declining should keep it that way.
2. Allow analytics; inspect Network and GA4 Realtime/Tag Assistant. Expect one `page_view`. Follow a section anchor: no extra page view. Click a portal-access link: expect one `portal_access` with the fixed placement/role.
3. Inspect payloads: `page_location` must be the canonical root, and `page_referrer` must contain only an origin. Open login and a dashboard directly: no Google script or events should load there.
4. In GA4's traffic acquisition reporting, inspect **Session source / medium**. Identifiable AI referrals can appear as referring domains such as `chatgpt.com` or `perplexity.ai`; filter by those sources. Referrals depend on browsers/apps supplying a referrer. Visits with stripped referrers may appear as direct traffic. This measures incoming visits, not every AI mention or citation. Query-based campaign attribution is intentionally not forwarded by this integration.

## Validation and remaining checks

Run `npm run build` before `npm test`, since the public HTTP test verifies actual build artifacts.

- Production and default noindex builds completed; lint passed.
- Existing 70 regression tests passed using disposable MongoDB, including login/session, role isolation, record ownership and private downloads. No production database was accessed.
- Two added tests passed: built HTML/metadata/structured-data CSP hashes/assets/200 and 404 responses/noindex/anonymous API rejection; analytics ID/consent/private-page gating/sanitized payloads/single pageview.
- Browser inspection verified the public content at desktop and 390px phone widths, section navigation, no horizontal overflow at the phone viewport, the typography fallback, and no Google script with analytics unconfigured. The build includes the self-hosted font. Public-page console inspection reported no errors, but the temporary preview server logged request failures; full browser asset/loading verification remains a manual check with the deployment's correct CORS origin configuration.
- Full interactive login, keyboard traversal, tablet layout, and reduced-motion emulation were not completed. The browser automation tool stopped because it could not reliably determine the native browser URL. Focus styles, semantic links/details, skip link, responsive breakpoints, and reduced-motion CSS are implemented; manually verify these before launch.
- Production account credentials were not supplied. End-to-end production logins, real WhatsApp connectivity, production HTTP responses, static-host rules, Search Console, and GA4 delivery require owner access after deployment. The automated login tests use disposable fixtures only.

### Existing private-storage limitation

The existing README/security guide reports eight legacy study notes with public delivery mode. The homepage does not reference them, and new notes use authenticated storage, but noindex/authenticated portal pages cannot revoke an already-public storage URL. Before launch, review the existing `docs/SECURITY-HANDOFF.md` private-note migration procedure with production access. No migration or storage mutation was run here. Existing profile image delivery also remains unchanged.

## Launch checklist

- [ ] Review the homepage and complete the manual checks above; confirm all three roles can sign in and reach only their own permitted records.
- [ ] Review the legacy private-note migration and verify storage protection.
- [ ] Set production frontend variables; build, lint and test. Deploy only when separately authorized, using the appropriate hosting rules above.
- [ ] Verify the production homepage is HTTP 200 with index/follow and no noindex response header. Check source HTML, canonical, social asset, robots and sitemap; confirm unknown URLs are 404 and previews/login pages remain noindex.
- [ ] Verify ownership of the production property in Google Search Console (DNS verification of the domain property or a supported URL-prefix verification method). Submit `https://myacademy.ahmedcodes.pro/sitemap.xml`.
- [ ] Inspect `https://myacademy.ahmedcodes.pro/`, run Test live URL and request indexing. See [Google's URL Inspection guidance](https://support.google.com/webmasters/answer/9012289). Indexing and search/AI citations are not guaranteed.
- [ ] If desired, configure GA4, disable enhanced measurement, rebuild, and verify consent plus events and referral reporting as above.

## Dashboard screenshots and motion update

The homepage now uses the three owner-supplied dashboard screenshots. Only flattened, opaquely redacted WebP derivatives are public; originals are not copied into the repository or build. Names, registration details, email, attendance, fee information, and account rows are masked before resizing. The source images remain untouched. The preparation script accepts the teacher, student, and administrator screenshot paths as three arguments: `node scripts/prepare-dashboard-previews.cjs <teacher.png> <student.png> <admin.png>`. Redaction coordinates deliberately fail for unexpected dimensions and must be reviewed for replacement screenshots.

Each screenshot has 640px, 1280px, and near-original 1918px variants (5–37 KB each). Responsive srcset selects a suitable size. Only the selected dashboard is mounted; others load on demand. Explicit aspect ratio reserves space, and a full-size link supports reading the interface on smaller screens. The initial teacher image is prioritized. There is no slideshow timer or animation dependency.

Homepage anchors use native smooth scrolling. FAQ answers retain native details/summary semantics and static HTML, with a cancellable 260ms height transition for opening/closing. Hero, preview, and hover effects are subtle and stop for prefers-reduced-motion. Keyboard FAQ opening and closing, dashboard switching, initial HTML, lint, build, and the public-homepage regression tests were verified after the update.
