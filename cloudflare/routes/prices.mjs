import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
const DAY = 21600000;
export async function GET(request) {
    const ids = [...new Set((new URL(request.url).searchParams.get('ids') || '').split(',').filter(Boolean))];
    if (!ids.length || ids.length > 25 || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))
        return Response.json({ error: 'Invalid card IDs' }, { status: 400 });
    try {
        const inventory = await env.BUCKET.get('inventory/current.json');
        const stock = inventory ? await inventory.json() : null;
        const allowed = new Set(stock?.cards.map(c => c.id) || []);
        if (ids.some(id => !allowed.has(id)))
            return Response.json({ error: 'Card not in inventory' }, { status: 400 });
        const prices = {};
        const missing = [];
        for (const id of ids) {
            const object = await env.BUCKET.get('prices/' + id + '.json');
            const cached = object ? await object.json() : null;
            if (cached)
                prices[id] = cached;
            if (!cached || Date.now() - cached.fetchedAt >= DAY)
                missing.push(id);
        }
        if (missing.length) {
            const response = await fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Nerd4SaleGaming/1.0' }, body: JSON.stringify({ identifiers: missing.map(id => ({ id })) }), signal: AbortSignal.timeout(20000) });
            if (!response.ok)
                return Response.json({ prices, error: 'Pricing provider temporarily unavailable' }, { status: 200 });
            const data = await response.json();
            const fetchedAt = Date.now();
            for (const card of data.data || []) {
                const value = { usd: card.prices?.usd ?? null, usd_foil: card.prices?.usd_foil ?? null, usd_etched: card.prices?.usd_etched ?? null, url: card.purchase_uris?.tcgplayer || null, fetchedAt };
                prices[card.id] = value;
                await env.BUCKET.put('prices/' + card.id + '.json', JSON.stringify(value));
            }
            for (const id of missing) {
                if (!prices[id]) {
                    const value = { usd: null, usd_foil: null, usd_etched: null, url: null, fetchedAt };
                    prices[id] = value;
                    await env.BUCKET.put('prices/' + id + '.json', JSON.stringify(value));
                }
            }
        }
        return Response.json({ prices }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch {
        return Response.json({ prices: {}, error: 'Pricing temporarily unavailable' }, { status: 503 });
    }
}
