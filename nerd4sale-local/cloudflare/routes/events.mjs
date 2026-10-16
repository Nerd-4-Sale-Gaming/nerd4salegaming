import { env } from 'cloudflare:workers';
import { isAdmin } from '../auth.mjs';
export const dynamic = 'force-dynamic';
async function read() { const obj = await env.BUCKET.get('shows/events.json'); return obj ? await obj.json() : []; }
export async function GET() { return Response.json({ events: await read() }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request) { return mutate(request); }
export async function DELETE(request) { return mutate(request); }
async function mutate(request) {
    if (!await isAdmin())
        return Response.json({ error: 'Admin access required' }, { status: 403 });
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return Response.json({ error: 'Invalid origin' }, { status: 403 });
    try {
        const text = await request.text();
        if (text.length > 12000)
            throw Error('Event details are too long');
        const body = JSON.parse(text);
        const events = await read();
        if (request.method === 'DELETE') {
            const index = events.findIndex(e => e.id === body.id);
            if (index < 0)
                throw Error('Event not found');
            events.splice(index, 1);
        }
        else {
            const event = {};
            for (const [key, max] of [['name', 150], ['date', 10], ['endDate', 10], ['hours', 150], ['venue', 200], ['address', 500], ['details', 3000], ['url', 1000]]) {
                if (body[key] != null && typeof body[key] !== 'string')
                    throw Error('Invalid ' + key);
                event[key] = (body[key] || '').trim();
                if (event[key].length > max)
                    throw Error(key + ' is too long');
            }
            if (!event.name || !event.venue || !event.address)
                throw Error('Name, venue, and address are required');
            const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
            if (!validDate(event.date) || event.endDate && !validDate(event.endDate))
                throw Error('Enter a valid event date');
            if (event.endDate && event.endDate < event.date)
                throw Error('End date must be on or after start date');
            if (event.url) {
                const u = new URL(event.url);
                if (!['http:', 'https:'].includes(u.protocol))
                    throw Error('Event link must use http or https');
            }
            const index = events.findIndex(e => e.id === body.id);
            if (body.id && index < 0)
                throw Error('Event not found');
            event.id = body.id || crypto.randomUUID();
            if (index >= 0)
                events[index] = event;
            else {
                if (events.length >= 500)
                    throw Error('Maximum 500 events');
                events.push(event);
            }
        }
        events.sort((a, b) => a.date.localeCompare(b.date));
        await env.BUCKET.put('shows/events.json', JSON.stringify(events));
        return Response.json({ success: true });
    }
    catch (e) {
        return Response.json({ error: e.message || 'Could not save event' }, { status: 400 });
    }
}
