// @ts-nocheck
export function parseCSV(text) { const rows = []; let row = [], cell = '', quoted = false; text = text.replace(/^\uFEFF/, ''); for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
        if (quoted && text[i + 1] === '"') {
            cell += '"';
            i++;
        }
        else
            quoted = !quoted;
    }
    else if (ch === ',' && !quoted) {
        row.push(cell);
        cell = '';
    }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && text[i + 1] === '\n')
            i++;
        row.push(cell);
        if (row.some(v => v.trim()))
            rows.push(row);
        row = [];
        cell = '';
    }
    else
        cell += ch;
} if (quoted)
    throw Error('Unclosed quoted field in CSV.'); row.push(cell); if (row.some(v => v.trim()))
    rows.push(row); return rows; }
export function inventoryFromCSV(text) { const rows = parseCSV(text); if (rows.length < 2)
    throw Error('The file needs a header and at least one card.'); const headers = rows.shift().map(h => h.trim().toLowerCase()); const col = (...names) => names.map(n => headers.indexOf(n)).find(n => n >= 0); const n = col('name', 'card name', 'product name'), s = col('set name', 'set code', 'set'), qty = col('quantity', 'qty', 'total quantity', 'quantities', 'add to quantity'), f = col('foil', 'printing', 'variant'), cond = col('condition'), lang = col('language'), id = col('scryfall id'), collector = col('collector number', 'card number', 'number', 'card #'), setCode = col('set code'), product = col('product id'); if (n === undefined && product === undefined)
    throw Error('Missing card name, Product Name, or Product ID column.'); return rows.map((r, i) => { const name = (r[n] || (r[product] ? 'Product ' + r[product] : '')).trim(); const count = qty === undefined ? 1 : Number(r[qty]); if (!name || !Number.isInteger(count) || count < 0)
    throw Error(`Check card name and quantity on data row ${i + 1}.`); return { finish: /etched/i.test(r[f] || r[cond] || '') ? 'etched' : (/foil/i.test(r[f] || r[cond] || '') && !/non.?foil/i.test(r[f] || r[cond] || '') || ['true', 'yes', '1'].includes((r[f] || r[cond] || '').trim().toLowerCase()) ? 'foil' : 'normal'), setCode: (r[setCode] || '').trim(), productId: (r[product] || '').trim(), collectorNumber: (r[collector] || '').trim(), name, id: (r[id] || '').trim(), set: (r[s] || 'Unspecified').trim(), qty: count, foil: (/foil|etched/i.test(r[f] || r[cond] || '') && !/non.?foil/i.test(r[f] || r[cond] || '')) || ['true', 'yes', '1'].includes((r[f] || r[cond] || '').trim().toLowerCase()), condition: r[cond] || 'Unspecified', language: r[lang] || 'Unspecified' }; }).filter(c => c.qty > 0); }
