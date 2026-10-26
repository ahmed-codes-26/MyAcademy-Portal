import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
// Full document navigation keeps analytics and public content out of private pages.
const root = document.getElementById('root');
if (window.location.pathname === '/') {
  import('./pages/HomePage').then(({ default: HomePage }) => {
    const page = <StrictMode><HomePage /></StrictMode>;
    if (root.hasChildNodes()) hydrateRoot(root, page);
    else createRoot(root).render(page);
  });
} else {
  document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, follow');
  document.querySelector('link[rel="canonical"]')?.remove();
  document.title = 'Sign in & workspace | MyAcademy Portal';
  import('./App').then(({ default: App }) => createRoot(root).render(<StrictMode><App /></StrictMode>));
}
