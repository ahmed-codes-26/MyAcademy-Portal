import { build, loadEnv } from 'vite';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const origin = 'https://myacademy.ahmedcodes.pro';
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const indexable = env.VITE_PUBLIC_INDEXING === 'true';
await build();
await build({ build: { ssr: 'src/entry-home.jsx', outDir: '.cache/home-render', emptyOutDir: true } });
const { render } = await import(pathToFileURL(path.resolve('.cache/home-render/entry-home.js')));
let shell = await readFile('dist/index.html', 'utf8');
// The SPA shell never contains public-page markup or an indexable directive.
shell = shell.replace('<head>', '<head>\n    <meta name="robots" content="noindex, follow" />');
await writeFile('dist/portal.html', shell);
await writeFile('dist/404.html', shell.replace('<div id="root"></div>', '<div id="root"><main><h1>Page not found</h1><p>This page does not exist.</p><a href="/">Return to MyAcademy Portal</a></main></div>'));
const title = 'MyAcademy Portal | Attendance, Fees & Study Materials';
const description = 'A tuition-center portal for administrators, teachers, and students. Manage attendance, monthly fees, accounts, and class study materials in one place.';
const data = JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'MyAcademy Portal', url: `${origin}/`, description, creator: { '@type': 'Person', name: 'Ahmed Ali' } },
  { '@type': 'SoftwareApplication', '@id': `${origin}/#application`, name: 'MyAcademy Portal', url: `${origin}/`, applicationCategory: 'EducationalApplication', operatingSystem: 'Web browser', description, creator: { '@type': 'Person', name: 'Ahmed Ali' }, featureList: ['Attendance records', 'Monthly fee management', 'Class study materials', 'Student and teacher account management'] },
] });
const hash = createHash('sha256').update(data).digest('base64');
let home = shell.replace('content="noindex, follow"', `content="${indexable ? 'index, follow' : 'noindex, follow'}"`)
  .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
  .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`)
  .replace("script-src 'self'", `script-src 'self' 'sha256-${hash}'`)
  .replace('<div id="root"></div>', `<div id="root">${render()}</div>`);
const css = (await readdir('dist/assets')).filter(file => file.startsWith('HomePage-') && file.endsWith('.css'));
const metadata = `
    <link rel="canonical" href="${origin}/" />
    <meta name="theme-color" content="#203b37" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="MyAcademy Portal" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${origin}/" />
    <meta property="og:image" content="${origin}/social-preview.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="MyAcademy Portal — attendance, monthly fees, and study materials for your academy." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${origin}/social-preview.png" />
    <meta name="twitter:image:alt" content="MyAcademy Portal — your academy’s everyday work, together." />
    <script type="application/ld+json">${data}</script>
    ${css.filter(file => !home.includes(`/assets/${file}`)).map(file => `<link rel="stylesheet" href="/assets/${file}" />`).join('\n    ')}
`;
home = home.replace('</head>', `${metadata}</head>`);
await writeFile('dist/index.html', home);
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`);
console.log(`Homepage prerendered; indexing ${indexable ? 'enabled (production artifact only)' : 'disabled (preview default)'}.`);
