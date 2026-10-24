# Login sessions and WhatsApp reminders

Implemented and verified October 24, 2026, using disposable local accounts/database and simulated WhatsApp connection states. No live credentials, sessions, or WhatsApp messages were used in testing.

## Behavior

- Selecting Student, Teacher, or Admin login now searches only that account type. Correct credentials from another role receive the same generic invalid-credentials response, with no token or redirect. Legacy API clients that omit role retain automatic lookup.
- Newly issued JWTs last seven days for all three roles. Opening/reloading the app validates the existing token and replaces it with a fresh seven-day token and current profile. Returning to a visible tab also renews, with a one-minute debounce; a visible open portal renews hourly. A single in-flight renewal prevents duplicate requests.
- Renewal requires an unexpired, correctly signed token for an existing account with an unchanged password fingerprint. Seven days without returning requires signing in again. Existing valid 24-hour tokens can renew; already expired tokens cannot.
- Password changes still invalidate earlier tokens. Delayed refresh responses cannot restore a logged-out session or overwrite a newer login/password-change token. A late 401 from an older token cannot clear a newer session. Logout remains local, as previously documented; this is not a server-side token revocation redesign.
- A teacher's portal checks WhatsApp status on opening, returning to the tab, and every 30 seconds while visible. A disconnected state shows a ten-second warning toast with a **Connect WhatsApp** link. It repeats on reopening while disconnected and when a new disconnection is detected. Returning to a disconnected portal can remind again, debounced for one minute to avoid duplicate focus/visibility toasts.
- Ordinary navigation and repeated background checks do not flood the page with the same warning. A confirmed connected status dismisses an outstanding reminder. Temporary status-request failures are not reported as disconnections. Admin/student sessions never request teacher WhatsApp status.

## Checks completed

- `npm test --prefix server`: **56/56 passed**, including strict role selection, seven-day expiry, simulated day-six renewal, and rejection of missing/forged/expired/deleted-account/password-invalidated renewal attempts.
- Production frontend build passed. Lint has only the existing Fast Refresh export warnings in AuthContext and Toast. The old unused useRef attendance warning was resolved by using the ref for the date dialog.
- Real desktop (1440×1000) and mobile (390×844) Chrome: six role/viewport scenarios passed against the actual local API. Verified wrong-panel rejection, seven-day tokens, day-six renewal on reload, renewal on focus, reconnect link, disconnected reminders on reopening, live disconnect detection, and no warnings after connection. Also held a renewal response until after admin logout and confirmed it did not restore the token/session.
- WhatsApp statuses were simulated at the provider boundary; this does not claim a new real-device Baileys reconnection test.

Browser artifacts: `C:/Users/ahmed/.codex/visualizations/2026/10/18/01a14df2-9ad1-7880-ae25-4c2110a79e90/security-verification/session-whatsapp-browser.cjs`, `session-whatsapp-results.json`, and `whatsapp-reminder-{desktop,mobile}.png`.

## Manual checks

1. Select Student login and enter valid admin credentials. Expect an error and no redirect. Repeat with teacher/admin panels and mismatched accounts, then sign in correctly.
2. Close/reopen or reload each role's dashboard. It should remain signed in and save a fresh token. The automated test simulates day six without waiting six days; a session unused for more than seven days should require sign-in.
3. As a teacher with disconnected WhatsApp, open the portal. Click Connect WhatsApp in the reminder and link the account. Reopen: no disconnected warning once the server reports connected.
4. With a test WhatsApp account, disconnect it and leave the portal visible: the global reminder should appear within about 30 seconds. Reopen while still disconnected: the reminder should appear again.
5. Log out and reload: the session must stay logged out. Change a test account password and verify an older browser session cannot renew.

Deploy the updated backend and frontend together. No database migration, new dependencies, or new environment variables are required. Code has not been pushed or deployed.

Changed files for this request: `server/routes/auth.js`, `server/utils/tokens.js`, `server/tests/security.test.js`, `client/src/context/AuthContext.jsx`, `client/src/api/axios.js`, `client/src/components/Toast.jsx`, `client/src/components/WhatsAppConnectionReminder.jsx`, `client/src/App.jsx`, `SECURITY-HANDOFF.md`, and this document.
