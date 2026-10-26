import { useState } from 'react';
const configured = /^G-[A-Z0-9]+$/.test(import.meta.env.VITE_GA_MEASUREMENT_ID || '');
export default function PublicAnalyticsConsent() {
  const [choice, setChoice] = useState(null);
  if (!configured) return null;
  function choose(allowed) {
    window.myAcademyAnalyticsConsent = allowed;
    setChoice(allowed);
    window.dispatchEvent(new CustomEvent('myacademy:analytics-consent', { detail: allowed }));
  }
  return <aside className="analytics-consent" aria-label="Optional analytics">
    {choice === null ? <><p>Allow optional analytics on this homepage? It helps measure visits and portal-access clicks. Your dashboard activity is not tracked.</p><button onClick={() => choose(true)}>Allow analytics</button><button onClick={() => setChoice(false)}>No thanks</button></> : <button onClick={() => choice ? choose(false) : setChoice(null)}>{choice ? 'Turn off analytics' : 'Analytics preferences'}</button>}
  </aside>;
}
