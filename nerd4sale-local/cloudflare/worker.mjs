import * as inventory from './routes/inventory.mjs';
import * as prices from './routes/prices.mjs';
import * as carts from './routes/carts.mjs';
import * as buylists from './routes/buylists.mjs';
import * as buyquote from './routes/buylist-quote.mjs';
import * as sealed from './routes/sealed.mjs';
import * as events from './routes/events.mjs';
import * as note from './routes/vendor-note.mjs';
import { authContext, verifyAdmin } from './auth.mjs';
import { refreshScheduled } from './scheduler.mjs';
const routes = { '/api/inventory': inventory, '/api/prices': prices, '/api/carts': carts, '/api/buylists': buylists, '/api/buylist-quote': buyquote, '/api/sealed': sealed, '/api/events': events, '/api/vendor-note': note };
const json = (data, status) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const adminPath = /^\/admin(?:\/|\.html|$)/.test(decodeURIComponent(url.pathname));
      // Verify signatures rather than trusting email headers, on every path.
      const admin = await verifyAdmin(request, env);
      if (adminPath && !admin) return new Response('Admin login required. Open https://nerd4salegaming.com/admin to sign in. If login does not appear, finish the Cloudflare Access setup in CLOUDFLARE-SETUP.md.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
      return await authContext.run(admin, async () => {
        if (url.pathname.startsWith('/api/')) {
          const route = routes[url.pathname];
          if (!route) return json({ error: 'Not found' }, 404);
          const method = route[request.method];
          if (!method) return json({ error: 'Method not allowed' }, 405);
          return await method(request);
        }
        if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
        if (adminPath) url.pathname = '/admin.html';
        else if (url.pathname === '/') url.pathname = '/index.html';
        const response = await env.ASSETS.fetch(new Request(url, request));
        const headers = new Headers(response.headers);
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        headers.set('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
        if (adminPath) headers.set('Cache-Control', 'no-store');
        return new Response(response.body, { status: response.status, headers });
      });
    } catch (error) { console.error('Request failed:', error.message); return json({ error: 'Request temporarily unavailable' }, 500); }
  },
  async scheduled(controller, env, ctx) { ctx.waitUntil(refreshScheduled(env, controller.scheduledTime)); }
};
