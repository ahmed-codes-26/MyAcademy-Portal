// This module is loaded only by the public homepage. All payload values are allowlisted.
const id = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
const origin = 'https://myacademy.ahmedcodes.pro';
let started = false;
function safeReferrer() {
  try { return new URL(document.referrer).origin; } catch { return ''; }
}
function enable() {
  if (started || !/^G-[A-Z0-9]+$/.test(id) || window.location.origin !== origin || window.location.pathname !== '/') return;
  started = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, { send_page_view: false, page_location: `${origin}/`, page_referrer: safeReferrer(), page_title: 'MyAcademy Portal', allow_google_signals: false, allow_ad_personalization_signals: false });
  window.gtag('event', 'page_view', { page_location: `${origin}/`, page_referrer: safeReferrer(), page_title: 'MyAcademy Portal' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
}
export function startPublicAnalytics() {
  // No existing consent UI. Require an explicit integration-provided opt-in.
  if (window.myAcademyAnalyticsConsent === true) enable();
  const consent = event => { if (event.detail === true) enable(); else window.location.reload(); };
  window.addEventListener('myacademy:analytics-consent', consent);
  return () => window.removeEventListener('myacademy:analytics-consent', consent);
}
export function trackPortalAccess(placement, role = 'unspecified') {
  if (!started || window.location.pathname !== '/') return;
  if (!['header', 'hero', 'role', 'footer'].includes(placement) || !['student', 'teacher', 'admin', 'returning', 'unspecified'].includes(role)) return;
  window.gtag('event', 'portal_access', { placement, role, page_location: `${origin}/`, transport_type: 'beacon' });
}
