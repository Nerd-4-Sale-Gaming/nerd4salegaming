import { env } from 'cloudflare:workers';
import { isAdmin } from '../auth.mjs';
import { inventoryFromCSV } from '../lib/csv.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const stored = await env.BUCKET.get('inventory/current.json');
        return new Response(stored ? await stored.text() : JSON.stringify({ cards: null }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    catch {
        return Response.json({ error: 'Inventory temporarily unavailable' }, { status: 503 });
    }
}
export async function PUT(request) {
    if (!await isAdmin())
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return Response.json({ error: 'Invalid request origin' }, { status: 403 });
    if (Number(request.headers.get('content-length') || 0) > 10000000)
        return Response.json({ error: 'File too large' }, { status: 413 });
    try {
        const reader = request.body?.getReader();
        if (!reader)
            throw Error('Choose a CSV.');
        let size = 0;
        const chunks = [];
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > 10000000) {
                await reader.cancel();
                return Response.json({ error: 'File too large' }, { status: 413 });
            }
            chunks.push(value);
        }
        const raw = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            raw.set(chunk, offset);
            offset += chunk.length;
        }
        const cards = inventoryFromCSV(new TextDecoder().decode(raw));
        if (!cards.length)
            throw Error('No in-stock cards found. Existing inventory retained.');
        await env.BUCKET.put('inventory/current.json', JSON.stringify({ cards, updatedAt: new Date().toISOString() }), { httpMetadata: { contentType: 'application/json' } });
        return Response.json({ count: cards.length });
    }
    catch (e) {
        return Response.json({ error: e.message || 'Upload failed. Existing inventory retained.' }, { status: 400 });
    }
}
