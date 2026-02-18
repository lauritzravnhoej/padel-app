import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const { method } = req;

    if (method === 'GET') {
        const { room } = req.query;
        if (!room) {
            return res.status(400).json({ error: 'Room code is required.' });
        }
        const data = await kv.get(room);
        return res.status(200).json(data || null);
    }

    if (method === 'POST') {
        const { room, data } = req.body;
        if (!room || !data) {
            return res.status(400).json({ error: 'Room code and data are required.' });
        }
        await kv.set(room, data);
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
}
