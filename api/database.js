import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    const { method } = req;
    const { room } = req.query || req.body;

    if (!room) return res.status(400).json({ error: 'Room code required' });

    if (method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('data')
                .eq('id', room)
                .single();

            if (error && error.code !== 'PGRST116') throw error; 
            return res.status(200).json(data ? data.data : null);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    if (method === 'POST') {
        const { data } = req.body;
        try {
            const { error } = await supabase
                .from('rooms')
                .upsert({ id: room, data: data, updated_at: new Date() });

            if (error) throw error;
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).end();
}