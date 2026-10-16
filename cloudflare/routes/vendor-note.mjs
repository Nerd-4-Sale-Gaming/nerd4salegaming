import { env } from 'cloudflare:workers';
import { isAdmin } from '../auth.mjs';
export const dynamic = 'force-dynamic';
export async function GET() { const obj = await env.BUCKET.get('content/vendor-note.json'); return Response.json(obj ? await obj.json() : { text: 'Welcome to Nerd 4 Sale Gaming! Browse our inventory and find us at an upcoming show.' }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function PUT(request) { if (!await isAdmin())
    return Response.json({ error: 'Admin access required' }, { status: 403 }); if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Invalid origin' }, { status: 403 }); try {
    const raw = await request.text();
    if (raw.length > 20000)
        throw Error('Note is too long');
    const body = JSON.parse(raw);
    if (typeof body.text !== 'string' || body.text.length > 5000)
        throw Error('Use up to 5,000 characters');
    await env.BUCKET.put('content/vendor-note.json', JSON.stringify({ text: body.text.trim() }));
    return Response.json({ success: true });
}
catch (e) {
    return Response.json({ error: e.message || 'Could not save note' }, { status: 400 });
} }
