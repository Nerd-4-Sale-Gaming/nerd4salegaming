import { env } from 'cloudflare:workers';
import { isAdmin } from '../auth.mjs';
import { sealedFromCSV, decorateSealed } from '../lib/sealed.mjs';
import { sealedSourceCSV } from '../lib/sealed-source.mjs';
import { sealedSeed } from '../lib/sealed-seed.mjs';
export const dynamic = 'force-dynamic';
export async function readSealed() { const obj = await env.BUCKET.get('inventory/sealed.json'); return decorateSealed(obj ? await obj.json() : sealedSeed); }
export async function GET(request) { const url = new URL(request.url), admin = url.searchParams.has('admin'), source = url.searchParams.has('source'); if ((admin || source) && !await isAdmin())
    return Response.json({ error: 'Admin access required' }, { status: 403 }); if (source) {
    const obj = await env.BUCKET.get('inventory/sealed-source.csv');
    return new Response(obj ? await obj.arrayBuffer() : sealedSourceCSV, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="sealed-inventory.csv"', 'Cache-Control': 'no-store' } });
} const stock = await readSealed(); return Response.json(admin ? stock : { ...stock, products: stock.products }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function PUT(request) { if (!await isAdmin())
    return Response.json({ error: 'Admin access required' }, { status: 403 }); if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Invalid origin' }, { status: 403 }); try {
    const reader = request.body?.getReader();
    if (!reader)
        throw Error('Choose a CSV');
    let size = 0;
    const chunks = [];
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        size += value.length;
        if (size > 10000000) {
            await reader.cancel();
            throw Error('CSV must be under 10 MB');
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let i = 0;
    for (const c of chunks) {
        bytes.set(c, i);
        i += c.length;
    }
    const parsed = sealedFromCSV(new TextDecoder().decode(bytes));
    const previous = await readSealed();
    const overrides = new Map(previous.products.map((p) => [p.productId, p]));
    const products = parsed.products.map((p) => { const old = overrides.get(p.productId); return old?.customContents ? { ...p, contents: old.contents, contentsSource: old.contentsSource, customContents: true } : p; });
    const stock = { products, skipped: parsed.skipped, updatedAt: new Date().toISOString() };
    await env.BUCKET.put('inventory/sealed-source.csv', bytes);
    await env.BUCKET.put('inventory/sealed.json', JSON.stringify(stock));
    return Response.json({ count: products.length, skipped: parsed.skipped.length });
}
catch (e) {
    return Response.json({ error: e.message || 'Upload failed' }, { status: 400 });
} }
export async function PATCH(request) { if (!await isAdmin())
    return Response.json({ error: 'Admin access required' }, { status: 403 }); if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Invalid origin' }, { status: 403 }); try {
    const text = await request.text();
    if (text.length > 30000)
        throw Error('Contents too long');
    const body = JSON.parse(text);
    if (!Array.isArray(body.contents) || body.contents.length > 200 || body.contents.some((c) => typeof c !== 'string' || c.length > 200))
        throw Error('Use one card name per line, up to 200 cards.');
    if (body.source && !/^https:\/\//.test(body.source))
        throw Error('Source must be an HTTPS URL.');
    const stock = await readSealed();
    const product = stock.products.find((p) => p.productId === body.productId);
    if (!product)
        throw Error('Product not found');
    product.contents = body.contents.map((c) => c.trim()).filter(Boolean);
    product.contentsSource = String(body.source || '').slice(0, 1000);
    product.customContents = true;
    stock.updatedAt = new Date().toISOString();
    await env.BUCKET.put('inventory/sealed.json', JSON.stringify(stock));
    return Response.json({ success: true });
}
catch (e) {
    return Response.json({ error: e.message || 'Update failed' }, { status: 400 });
} }
