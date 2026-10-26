const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const createApp = require('../app');
const routes = require('../../client/portal-routes.json');
const dist = path.resolve(__dirname, '../../client/dist');

test('built public homepage: initial HTML, metadata, assets, routing, noindex and unauthenticated API protection', async () => {
  assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'Run npm run build first');
  const server = createApp({ staticDir: dist, production: true, trustProxy: 'loopback' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (url, host = 'myacademy.ahmedcodes.pro') => fetch(base + url, { headers: { 'X-Forwarded-Host': host, 'X-Forwarded-Proto': 'https' } });
  try {
    const response = await get('/');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), null);
    const html = await response.text();
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    for (const text of ['Less admin.', 'For students', 'For teachers', 'For administrators', 'Ahmed Ali', 'How do I get an account?']) assert.ok(html.includes(text));
    assert.ok(html.includes('rel="canonical" href="https://myacademy.ahmedcodes.pro/"'));
    assert.ok(!html.includes('localhost'));
    const data = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
    assert.equal(JSON.parse(data)['@graph'].length, 2);
    assert.ok(response.headers.get('content-security-policy').includes(createHash('sha256').update(data).digest('base64')));
    for (const asset of new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"#]+|\/social-preview.png)"/g)].map(match => match[1]))) assert.equal((await get(asset)).status, 200, asset);
    assert.equal((await get('/social-preview.png')).headers.get('content-type'), 'image/png');
    assert.equal((await get('/', 'preview.example.test')).headers.get('x-robots-tag'), 'noindex, follow');
    for (const route of routes) {
      const result = await get(route);
      assert.equal(result.status, 200, route);
      const body = await result.text();
      assert.ok(body.includes('content="noindex, follow"'), route);
      assert.ok(!body.includes('Less admin.'), route);
    }
    for (const route of ['/missing-page', '/teacher/missing', '/assets/missing.js']) assert.equal((await get(route)).status, 404, route);
    const robots = await (await get('/robots.txt')).text();
    assert.ok(robots.includes('Allow: /'));
    assert.ok(!robots.includes('Disallow: /login'));
    const sitemap = await (await get('/sitemap.xml')).text();
    assert.equal((sitemap.match(/<loc>/g) || []).length, 1);
    assert.ok(sitemap.includes('<loc>https://myacademy.ahmedcodes.pro/</loc>'));
    for (const route of ['/api/students', '/api/teachers', '/api/teacher/dashboard', '/api/student/dashboard', '/api/test-notes', '/api/notes']) assert.equal((await get(route)).status, 401, route);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

function analyticsHarness(id, pathname = '/') {
  const scripts = [], listeners = {};
  const context = { URL, document: { referrer: 'https://chatgpt.com/private-conversation?secret=hidden', createElement: () => ({}), head: { appendChild: script => scripts.push(script) } }, window: { location: { origin: 'https://myacademy.ahmedcodes.pro', pathname, search: '?token=secret', reload() {} }, addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {} } };
  const source = fs.readFileSync(path.resolve(__dirname, '../../client/src/utils/publicAnalytics.js'), 'utf8').replace('import.meta.env.VITE_GA_MEASUREMENT_ID', JSON.stringify(id)).replaceAll('export function', 'function');
  vm.createContext(context); vm.runInContext(source, context);
  return { context, scripts, listeners };
}
test('analytics requires ID and consent, excludes private pages and sensitive URLs, and avoids duplicate page views', () => {
  const disabled = analyticsHarness(''); disabled.context.window.myAcademyAnalyticsConsent = true; disabled.context.startPublicAnalytics(); assert.equal(disabled.scripts.length, 0);
  const privatePage = analyticsHarness('G-TEST123', '/student/dashboard'); privatePage.context.window.myAcademyAnalyticsConsent = true; privatePage.context.startPublicAnalytics(); assert.equal(privatePage.scripts.length, 0);
  const active = analyticsHarness('G-TEST123'); active.context.startPublicAnalytics(); assert.equal(active.scripts.length, 0);
  active.listeners['myacademy:analytics-consent']({ detail: true });
  active.listeners['myacademy:analytics-consent']({ detail: true });
  active.context.startPublicAnalytics(); active.context.trackPortalAccess('hero', 'student');
  assert.equal(active.scripts.length, 1);
  const events = active.context.window.dataLayer.map(args => Array.from(args));
  assert.equal(events.filter(event => event[1] === 'page_view').length, 1);
  assert.equal(events.filter(event => event[1] === 'portal_access').length, 1);
  const serialized = JSON.stringify(events);
  assert.ok(!serialized.includes('secret')); assert.ok(!serialized.includes('private-conversation'));
  assert.ok(serialized.includes('https://chatgpt.com'));
});
