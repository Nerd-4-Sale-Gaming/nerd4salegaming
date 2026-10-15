import { env } from './local-storage.mjs';
import { decorateSealed } from './sealed.mjs';
import { sealedSeed } from './sealed-seed.mjs';
const isAdmin = async () => true;
export const dynamic = 'force-dynamic';
export async function GET(request) { if (!await isAdmin())
    return Response.json({ error: 'Admin access required' }, { status: 403 }); const cursor = new URL(request.url).searchParams.get('cursor') || undefined; const list = await env.BUCKET.list({ prefix: 'carts/', limit: 50, cursor }); const carts = await Promise.all(list.objects.map(async (o) => { const item = await env.BUCKET.get(o.key); return item ? { ...await item.json(), storageKey: o.key } : null; })); return Response.json({ carts: carts.filter(Boolean), cursor: list.truncated ? list.cursor : null }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request) {
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return Response.json({ error: 'Invalid origin' }, { status: 403 });
    try {
        const reader = request.body?.getReader();
        if (!reader)
            throw Error('Missing request');
        let size = 0;
        const parts = [];
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            size += value.length;
            if (size > 32000) {
                await reader.cancel();
                throw Error('Cart too large');
            }
            parts.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const p of parts) {
            bytes.set(p, offset);
            offset += p.length;
        }
        const body = JSON.parse(new TextDecoder().decode(bytes));
        const name = String(body.name || '').trim();
        if (!name || name.length > 120)
            throw Error('Enter your name (up to 120 characters).');
        if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100)
            throw Error('Choose between 1 and 100 card entries.');
        const object = await env.BUCKET.get('inventory/current.json');
        if (!object && body.items.some((i) => i.type !== 'sealed'))
            throw Error('Singles inventory unavailable.');
        const stock = object ? await object.json() : { cards: [], updatedAt: null };
        const sealedObject = await env.BUCKET.get('inventory/sealed.json');
        const sealedStock = decorateSealed(sealedObject ? await sealedObject.json() : sealedSeed);
        if (body.items.some((i) => i.type !== 'sealed') && stock.updatedAt !== body.inventoryVersion)
            throw Error('Inventory changed. Refresh the page and review your cart.');
        const seen = new Set();
        const items = [];
        for (const item of body.items) {
            const entryKey = (item.type === 'sealed' ? 'sealed:' : 'single:') + item.index;
            if (!Number.isInteger(item.index) || seen.has(entryKey))
                throw Error('Invalid cart entry');
            seen.add(entryKey);
            if (item.type === 'sealed' && body.sealedVersion !== sealedStock.updatedAt)
                throw Error('Sealed inventory changed. Refresh and review your cart.');
            const card = item.type === 'sealed' ? sealedStock.products[item.index] : stock.cards[item.index];
            if (!card || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > card.qty)
                throw Error('A requested quantity exceeds available stock.');
            let price = item.type === 'sealed' ? card.price : null;
            let priceUpdatedAt = item.type === 'sealed' ? sealedStock.updatedAt : null;
            if (item.type !== 'sealed' && card.id) {
                const cached = await env.BUCKET.get('prices/' + card.id + '.json');
                if (cached) {
                    const p = await cached.json();
                    const raw = card.finish === 'etched' ? p.usd_etched : card.foil ? p.usd_foil : p.usd;
                    if (raw != null && Number.isFinite(Number(raw))) {
                        price = Number(raw);
                        priceUpdatedAt = p.fetchedAt;
                    }
                }
            }
            items.push({ type: item.type === 'sealed' ? 'sealed' : 'single', productId: card.productId || null, name: card.name, set: card.set, id: card.id, collectorNumber: card.collectorNumber || '', language: card.language, foil: card.foil, finish: card.finish, qty: item.qty, price, priceUpdatedAt, lineTotal: price === null ? null : Math.round(price * item.qty * 100) / 100 });
        }
        const id = crypto.randomUUID();
        const cart = { id, name, archived: false, createdAt: new Date().toISOString(), items, total: Math.round(items.reduce((s, c) => s + (c.lineTotal || 0), 0) * 100) / 100, hasUnpriced: items.some(c => c.price === null), currency: 'USD' };
        await env.BUCKET.put('carts/' + String(9999999999999 - Date.now()) + '-' + id + '.json', JSON.stringify(cart));
        return Response.json({ id, total: cart.total, hasUnpriced: cart.hasUnpriced }, { status: 201 });
    }
    catch (e) {
        return Response.json({ error: e.message || 'Unable to submit cart' }, { status: 400 });
    }
}
export async function PATCH(request) {
    if (!await isAdmin())
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return Response.json({ error: 'Invalid origin' }, { status: 403 });
    try {
        const text = await request.text();
        if (text.length > 2000)
            throw Error('Request too large');
        const body = JSON.parse(text);
        if (typeof body.archived !== 'boolean' || !/^carts\/\d{13}-[0-9a-f-]{36}\.json$/.test(body.storageKey))
            throw Error('Invalid cart');
        const object = await env.BUCKET.get(body.storageKey);
        if (!object)
            return Response.json({ error: 'Cart not found' }, { status: 404 });
        const cart = await object.json();
        cart.archived = body.archived;
        if (body.archived)
            cart.priceLockedAt ||= new Date().toISOString();
        cart.archivedAt = body.archived ? new Date().toISOString() : null;
        await env.BUCKET.put(body.storageKey, JSON.stringify(cart));
        return Response.json({ success: true });
    }
    catch (e) {
        return Response.json({ error: e.message || 'Unable to update cart' }, { status: 400 });
    }
}
export async function DELETE(request) {
    if (!await isAdmin())
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return Response.json({ error: 'Invalid origin' }, { status: 403 });
    try {
        const text = await request.text();
        if (text.length > 2000)
            throw Error('Request too large');
        const body = JSON.parse(text);
        if (!/^carts\/\d{13}-[0-9a-f-]{36}\.json$/.test(body.storageKey))
            throw Error('Invalid cart');
        const object = await env.BUCKET.get(body.storageKey);
        if (!object)
            return Response.json({ error: 'Cart not found' }, { status: 404 });
        await env.BUCKET.delete(body.storageKey);
        return Response.json({ success: true });
    }
    catch (e) {
        return Response.json({ error: e.message || 'Unable to delete cart' }, { status: 400 });
    }
}
