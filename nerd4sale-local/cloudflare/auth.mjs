import { AsyncLocalStorage } from 'node:async_hooks';
import { createRemoteJWKSet, jwtVerify } from 'jose';
export const authContext = new AsyncLocalStorage();
export async function isAdmin() { return authContext.getStore() === true; }
const keySets = new Map();
export async function verifyAdmin(request, env, trustedKeys) {
  const issuer = String(env.ACCESS_TEAM_DOMAIN || '').replace(/\/$/, '');
  const audience = env.ACCESS_AUD;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !audience) return false;
  const token = request.headers.get('Cf-Access-Jwt-Assertion') ||
    (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith('CF_Authorization='))?.slice(17);
  if (!token) return false;
  try {
    let keys = trustedKeys || keySets.get(issuer);
    if (!keys) { keys = createRemoteJWKSet(new URL(issuer + '/cdn-cgi/access/certs')); keySets.set(issuer, keys); }
    const { payload } = await jwtVerify(token, keys, { issuer, audience, algorithms: ['RS256'] });
    const emails = String(env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase());
    return typeof payload.email === 'string' && emails.includes(payload.email.toLowerCase());
  } catch { return false; }
}
