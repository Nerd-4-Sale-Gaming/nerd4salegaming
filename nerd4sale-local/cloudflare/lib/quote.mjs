// @ts-nocheck
import { canonical, quoteKey } from './buylist.mjs';
const headers = { 'Accept': 'application/json', 'User-Agent': 'Nerd4SaleGaming/1.0' };
export async function quoteCards(input, bucket) {
    const cards = canonical(input), key = await quoteKey(cards);
    const saved = await bucket.get(key);
    if (saved) {
        const data = await saved.json();
        if (Date.now() - data.fetchedAt < 86400000)
            return data;
    }
    let sets = {};
    if (cards.some(c => !c.id && !c.setCode && c.set !== 'Unspecified')) {
        const obj = await bucket.get('pricing-set-map.json');
        const cached = obj ? await obj.json() : null;
        if (cached && Date.now() - cached.fetchedAt < 86400000)
            sets = cached.sets;
        else {
            const r = await fetch('https://api.scryfall.com/sets', { headers });
            if (!r.ok)
                throw Error('Card matching provider unavailable. Try again later.');
            const data = await r.json();
            for (const s of data.data || []) {
                sets[s.name.toLowerCase()] = s.code;
                sets[s.code] = s.code;
            }
            await bucket.put('pricing-set-map.json', JSON.stringify({ sets, fetchedAt: Date.now() }));
        }
    }
    const identifiers = cards.map(c => c.id && /^[0-9a-f-]{36}$/i.test(c.id) ? { id: c.id } : ((c.setCode || sets[c.set.toLowerCase()]) ? (c.collectorNumber ? { set: c.setCode || sets[c.set.toLowerCase()], collector_number: c.collectorNumber } : { set: c.setCode || sets[c.set.toLowerCase()], name: c.name }) : null));
    const unique = [...new Map(identifiers.filter(Boolean).map(i => [JSON.stringify(i), i])).values()];
    let found = [];
    if (unique.length) {
        const r = await fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: unique }) });
        if (!r.ok)
            throw Error('Pricing provider unavailable. Try again later.');
        found = (await r.json()).data || [];
    }
    for (let i = 0; i < cards.length; i++) {
        if (!identifiers[i] && /^\d+$/.test(cards[i].productId)) {
            const r = await fetch('https://api.scryfall.com/cards/tcgplayer/' + cards[i].productId, { headers });
            if (r.ok) {
                const c = await r.json();
                found.push(c);
                identifiers[i] = { id: c.id };
            }
            else if (r.status !== 404)
                throw Error('Pricing provider unavailable. Try again later.');
            await new Promise(resolve => setTimeout(resolve, 120));
        }
    }
    const items = cards.map((c, i) => { const identifier = identifiers[i]; const match = identifier ? found.find(p => identifier.id ? p.id === identifier.id : p.set === identifier.set && (identifier.collector_number ? p.collector_number === identifier.collector_number : p.name.toLowerCase() === c.name.toLowerCase())) : null; const raw = match ? (c.finish === 'etched' ? match.prices?.usd_etched : c.foil ? match.prices?.usd_foil : match.prices?.usd) : null; const price = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null; return { ...c, name: match?.name || c.name, set: match?.set_name || c.set, id: match?.id || c.id, collectorNumber: c.collectorNumber || match?.collector_number || '', price, lineTotal: price == null ? null : Math.round(price * c.qty * 100) / 100 }; });
    const result = { items, fetchedAt: Date.now(), total: Math.round(items.reduce((s, c) => s + (c.lineTotal || 0), 0) * 100) / 100, hasUnpriced: items.some(c => c.price == null) };
    await bucket.put(key, JSON.stringify(result));
    return result;
}
