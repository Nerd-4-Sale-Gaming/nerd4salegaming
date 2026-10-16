import { env } from './local-storage.mjs';
import { quoteCards } from './quote.mjs';
export const dynamic = 'force-dynamic';
export async function POST(request) { if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Invalid origin' }, { status: 403 }); try {
    const text = await request.text();
    if (text.length > 64000)
        throw Error('Request too large');
    const body = JSON.parse(text);
    if (!Array.isArray(body.cards) || !body.cards.length || body.cards.length > 25 || body.cards.some((c) => !c.name || String(c.name).length > 250 || !Number.isInteger(c.qty) || c.qty < 1))
        throw Error('Invalid cards');
    return Response.json(await quoteCards(body.cards, env.BUCKET));
}
catch (e) {
    return Response.json({ error: e.message || 'Unable to price cards' }, { status: 400 });
} }
