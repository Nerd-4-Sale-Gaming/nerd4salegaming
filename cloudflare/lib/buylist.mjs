// @ts-nocheck
import { inventoryFromCSV, parseCSV } from './csv.mjs';
export function canonical(cards) { return cards.map(c => ({ name: String(c.name || '').trim(), id: String(c.id || '').trim(), set: String(c.set || 'Unspecified').trim(), setCode: String(c.setCode || '').trim().toLowerCase(), collectorNumber: String(c.collectorNumber || '').trim(), productId: String(c.productId || '').trim(), finish: c.finish || 'normal', foil: !!c.foil, language: c.language || 'Unspecified', condition: c.condition || 'Unspecified', qty: c.qty })); }
export function buylistFromCSV(text, format = 'auto') { let normalized = text; const rows = parseCSV(text); const headers = (rows[0] || []).map(h => h.trim().toLowerCase()); const positional = format === 'tcgplayer' || (format === 'auto' && headers.length >= 10 && /name|card/.test(headers[4]) && /foil|printing|finish|variant/.test(headers[9])); if (positional) {
    if (headers.length < 16)
        throw Error('This TCGplayer layout needs at least 16 columns (A–P), with quantity in P.');
    const converted = rows.map(r => [...r]);
    converted[0][4] = 'Name';
    converted[0][6] = 'Collector number';
    converted[0][9] = 'Foil';
    converted[0][15] = 'Quantity';
    for (let i = 0; i < converted[0].length; i++) {
        if (i !== 15 && ['quantity', 'qty', 'total quantity', 'quantities', 'add to quantity'].includes(converted[0][i].trim().toLowerCase()))
            converted[0][i] = 'Source quantity';
        if (i !== 4 && ['name', 'card name', 'product name'].includes(converted[0][i].trim().toLowerCase()))
            converted[0][i] = 'Source name';
        if (i !== 6 && ['collector number', 'card number', 'number', 'card #'].includes(converted[0][i].trim().toLowerCase()))
            converted[0][i] = 'Source number';
        if (i !== 9 && ['foil', 'printing', 'variant'].includes(converted[0][i].trim().toLowerCase()))
            converted[0][i] = 'Source finish';
    }
    normalized = converted.map(r => r.map(csvCell).join(',')).join('\r\n');
} const cards = canonical(inventoryFromCSV(normalized)); if (!cards.length)
    throw Error('The CSV contains no cards with positive quantities.'); if (cards.length > 10000)
    throw Error('Please split uploads into files of 10,000 entries or fewer.'); return cards; }
function csvCell(value) { return '"' + String(value ?? '').replace(/"/g, '""') + '"'; }
export function toManaBoxCSV(cards) { return [['Name', 'Set code', 'Set name', 'Collector number', 'Foil', 'Quantity', 'Scryfall ID', 'Language', 'Condition'], ...cards.map(c => [c.name, c.setCode || '', c.set === 'Unspecified' ? '' : c.set, c.collectorNumber, c.finish === 'etched' ? 'etched' : c.foil ? 'foil' : 'normal', c.qty, c.id, c.language === 'Unspecified' ? '' : c.language, c.condition === 'Unspecified' ? '' : c.condition])].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
export async function quoteKey(cards) { const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(cards)))); return 'buylist-quotes/' + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('') + '.json'; }
export function sortPriced(items, order) { return [...items].sort((a, b) => { if (a.price == null)
    return b.price == null ? 0 : 1; if (b.price == null)
    return -1; return order === 'high' ? b.price - a.price : a.price - b.price; }); }
