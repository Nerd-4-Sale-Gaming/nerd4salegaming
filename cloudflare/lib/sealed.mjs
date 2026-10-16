// @ts-nocheck
import { sldPrintings } from './sld-printings.mjs';
import { parseCSV } from './csv.mjs';
import { secretLairContents } from './secret-lair-contents.mjs';
export function sealedFromCSV(text) { const rows = parseCSV(text); if (rows.length < 2)
    throw Error('CSV needs a header and at least one product.'); const h = rows.shift().map(s => s.trim().toLowerCase()); const col = (...names) => names.map(n => h.indexOf(n)).find(i => i >= 0); const name = col('product name', 'name'), condition = col('condition'), id = col('product id'), set = col('set name', 'set'), total = col('total quantity', 'quantity', 'qty'), add = col('add to quantity'), image = col('photo url', 'image url'), market = col('tcg market price', 'market price'); if (name === undefined || condition === undefined)
    throw Error('Sealed import needs Product Name and Condition columns.'); const products = [], skipped = []; const seen = new Map(); for (let i = 0; i < rows.length; i++) {
    const r = rows[i], n = (r[name] || '').trim();
    if (!/^(unopened|sealed|factory sealed)$/i.test((r[condition] || '').trim())) {
        skipped.push(n || 'Row ' + (i + 2));
        continue;
    }
    const raw = String(r[total] || '').trim() || String(r[add] || '').trim();
    const qty = Number(raw);
    if (!n || !raw || !Number.isInteger(qty) || qty < 0)
        throw Error('Invalid product name or quantity on CSV row ' + (i + 2));
    if (!qty)
        continue;
    const productId = (r[id] || '').trim();
    if (!/^\d+$/.test(productId))
        throw Error('Missing numeric Product ID on CSV row ' + (i + 2));
    const rawPrice = (r[market] || '').trim().replace(/[$,]/g, '');
    const price = rawPrice && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0 ? Number(rawPrice) : null;
    const photo = (r[image] || '').trim();
    const imageUrl = /^https:\/\/(tcgplayer-cdn\.tcgplayer\.com|product-images\.tcgplayer\.com)\//i.test(photo) ? photo : '';
    const details = secretLairContents[productId];
    const key = productId;
    const previous = seen.get(key);
    if (previous) {
        previous.qty += qty;
        continue;
    }
    const p = { type: 'sealed', productId, name: displaySealedName(n), set: (r[set] || 'Unspecified').trim(), qty, imageUrl, condition: 'Unopened', price, priceSource: 'TCGplayer market value from uploaded CSV', contents: details?.cards || [], contentsSource: details?.source || '', isSecretLair: /secret lair/i.test(n) };
    seen.set(key, p);
    products.push(p);
} if (!products.length)
    throw Error('No in-stock unopened products found. Singles are excluded from sealed imports.'); return { products, skipped }; }
export function displaySealedName(name) { return String(name).replace(/^Secret Lair Drop:\s*/i, ''); }
export function decorateSealed(stock) { return { ...stock, products: stock.products.map(p => { const verified = secretLairContents[p.productId]; return { ...p, name: displaySealedName(p.name), contents: p.customContents ? p.contents : (verified?.cards || p.contents || []), contentsSource: p.customContents ? p.contentsSource : (verified?.source || p.contentsSource || ''), contentPrintings: sldPrintings[p.productId]?.cards || {} }; }) }; }
