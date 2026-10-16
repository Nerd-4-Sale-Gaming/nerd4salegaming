import { env } from 'cloudflare:workers';
import { isAdmin } from '../auth.mjs';
import { buylistFromCSV, quoteKey, toManaBoxCSV } from '../lib/buylist.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request) { if (!await isAdmin())
    return Response.json({ error: 'Admin access required' }, { status: 403 }); const url = new URL(request.url), download = url.searchParams.get('download'); if (download) {
    if (!/^buylist-files\/[0-9a-f-]{36}(?:-manabox)?\.csv$/.test(download))
        return Response.json({ error: 'Invalid file' }, { status: 400 });
    const recordKey = url.searchParams.get('record');
    let person = 'customer';
    if (recordKey && /^buylists\/\d{13}-[0-9a-f-]{36}\.json$/.test(recordKey)) {
        const saved = await env.BUCKET.get(recordKey);
        if (saved) {
            const record = await saved.json();
            if (record.csvKey === download || record.normalizedCsvKey === download)
                person = record.name;
        }
    }
    const safeName = String(person).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'customer';
    const file = await env.BUCKET.get(download);
    return file ? new Response(await file.arrayBuffer(), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + safeName + (download.endsWith('-manabox.csv') ? '-Buy-List-ManaBox.csv' : '-Buy-List-Original.csv') + '"', 'Cache-Control': 'no-store' } }) : Response.json({ error: 'File not found' }, { status: 404 });
} const list = await env.BUCKET.list({ prefix: 'buylists/', limit: 50, cursor: url.searchParams.get('cursor') || undefined }); const records = await Promise.all(list.objects.map(async (o) => { const item = await env.BUCKET.get(o.key); return item ? { ...await item.json(), storageKey: o.key } : null; })); return Response.json({ buylists: records.filter(Boolean), cursor: list.truncated ? list.cursor : null }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request) { if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Invalid origin' }, { status: 403 }); try {
    if (Number(request.headers.get('content-length') || 0) > 5500000)
        throw Error('File must be under 5 MB');
    const form = await request.formData();
    const name = String(form.get('name') || '').trim(), email = String(form.get('email') || '').trim(), phone = String(form.get('phone') || '').trim(), file = form.get('file');
    if (!name || name.length > 120 || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || phone.length > 40 || phone.replace(/\D/g, '').length < 7)
        throw Error('Enter a name, valid email, and cellphone number.');
    if (!file || typeof file === 'string' || file.size > 5000000 || !file.name.toLowerCase().endsWith('.csv'))
        throw Error('Choose a CSV under 5 MB.');
    const bytes = await file.arrayBuffer();
    const cards = buylistFromCSV(new TextDecoder().decode(bytes), String(form.get('format') || 'auto'));
    const items = [];
    for (let i = 0; i < cards.length; i += 25) {
        const saved = await env.BUCKET.get(await quoteKey(cards.slice(i, i + 25)));
        if (!saved)
            throw Error('Preview and price the complete CSV before submitting.');
        const quote = await saved.json();
        if (Date.now() - quote.fetchedAt > 86400000)
            throw Error('Preview expired. Price the CSV again.');
        items.push(...quote.items);
    }
    const id = crypto.randomUUID(), csvKey = 'buylist-files/' + id + '.csv', normalizedCsvKey = 'buylist-files/' + id + '-manabox.csv';
    const record = { id, name, email, phone, createdAt: new Date().toISOString(), archived: false, csvKey, normalizedCsvKey, fileName: file.name.slice(0, 200), items, total: Math.round(items.reduce((s, c) => s + (c.lineTotal || 0), 0) * 100) / 100, hasUnpriced: items.some(c => c.price == null), currency: 'USD' };
    await env.BUCKET.put(csvKey, bytes, { httpMetadata: { contentType: 'text/csv' } });
    try {
        await env.BUCKET.put(normalizedCsvKey, toManaBoxCSV(items), { httpMetadata: { contentType: 'text/csv' } });
        await env.BUCKET.put('buylists/' + String(9999999999999 - Date.now()) + '-' + id + '.json', JSON.stringify(record));
    }
    catch (e) {
        await env.BUCKET.delete(csvKey);
        await env.BUCKET.delete(normalizedCsvKey);
        throw e;
    }
    return Response.json({ id }, { status: 201 });
}
catch (e) {
    return Response.json({ error: e.message || 'Upload failed' }, { status: 400 });
} }
async function change(request, remove) {
    if (!await isAdmin())
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return Response.json({ error: 'Invalid origin' }, { status: 403 });
    try {
        const text = await request.text();
        if (text.length > 2000)
            throw Error('Request too large');
        const body = JSON.parse(text);
        if (!/^buylists\/\d{13}-[0-9a-f-]{36}\.json$/.test(body.storageKey))
            throw Error('Invalid buy list');
        const obj = await env.BUCKET.get(body.storageKey);
        if (!obj)
            return Response.json({ error: 'Not found' }, { status: 404 });
        const record = await obj.json();
        if (remove) {
            await env.BUCKET.delete(body.storageKey);
            await env.BUCKET.delete(record.csvKey);
            if (record.normalizedCsvKey)
                await env.BUCKET.delete(record.normalizedCsvKey);
        }
        else {
            if (typeof body.archived !== 'boolean')
                throw Error('Invalid archive status');
            record.archived = body.archived;
            record.archivedAt = body.archived ? new Date().toISOString() : null;
            if (body.archived)
                record.priceLockedAt ||= new Date().toISOString();
            await env.BUCKET.put(body.storageKey, JSON.stringify(record));
        }
        return Response.json({ success: true });
    }
    catch (e) {
        return Response.json({ error: e.message || 'Unable to update buy list' }, { status: 400 });
    }
}
export const PATCH = (request) => change(request, false);
export const DELETE = (request) => change(request, true);
