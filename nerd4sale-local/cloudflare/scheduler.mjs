const SIX_HOURS = 6 * 60 * 60 * 1000;
const stateKey = 'system/singles-price-refresh.json';
// A one-minute trigger advances a bounded batch. A new inventory-wide run starts
// once per six-hour UTC slot; progress persists between invocations and failures.
export async function refreshScheduled(env, now = Date.now()) {
  const bucket = env.BUCKET;
  const inventory = await bucket.get('inventory/current.json');
  if (!inventory) return;
  const stock = await inventory.json();
  const ids = [...new Set((stock.cards || []).map(c => c.id).filter(id => /^[0-9a-f-]{36}$/i.test(id)))];
  const slot = Math.floor(now / SIX_HOURS);
  const stored = await bucket.get(stateKey);
  let state = stored ? await stored.json() : null;
  if (!state || state.inventoryVersion !== stock.updatedAt || state.slot !== slot) {
    state = { slot, inventoryVersion: stock.updatedAt, cursor: 0, total: ids.length, startedAt: now, completedAt: null };
  }
  if (state.completedAt || (state.retryAfter && now < state.retryAfter)) return;
  try {
    const stop = Math.min(state.cursor + 450, ids.length);
    while (state.cursor < stop) {
      const batch = ids.slice(state.cursor, Math.min(state.cursor + 75, stop));
      const response = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Nerd4SaleGaming/1.0' },
        body: JSON.stringify({ identifiers: batch.map(id => ({ id })) }), signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw Error('Scryfall HTTP ' + response.status);
      const data = await response.json();
      const found = new Map((data.data || []).map(card => [card.id, card]));
      const missing = new Set((data.not_found || []).map(item => item.id));
      for (const id of batch) {
        const card = found.get(id);
        if (!card && !missing.has(id)) throw Error('Incomplete pricing response');
        // Explicit not-found cards keep previous data; never overwrite a cached
        // price merely because an upstream request failed or omitted a record.
        if (!card) continue;
        await bucket.put('prices/' + id + '.json', JSON.stringify({
          usd: card.prices?.usd ?? null, usd_foil: card.prices?.usd_foil ?? null,
          usd_etched: card.prices?.usd_etched ?? null, url: card.purchase_uris?.tcgplayer || null, fetchedAt: now
        }));
      }
      state.cursor += batch.length;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    state.error = null; state.retryAfter = null;
    if (state.cursor >= ids.length) state.completedAt = Date.now();
  } catch (error) {
    state.error = error.message; state.retryAfter = now + 30 * 60 * 1000;
    console.error('Singles refresh paused:', state.error);
  }
  await bucket.put(stateKey, JSON.stringify(state));
  console.log('Singles pricing progress', state.cursor, '/', ids.length);
}
