import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    const { method } = req;
    
    // RETTELSE: Vi tjekker specifikt efter 'room' i både query og body
    const room = req.query.room || req.body.room;

    if (!room) {
        return res.status(400).json({ error: 'Room code required (missing in query and body)' });
    }

    try {
        if (method === 'GET') {
            const { data, error } = await supabase
                .from('rooms')
                .select('data')
                .eq('id', room)
                .single();

            if (error && error.code !== 'PGRST116') throw error; 
            return res.status(200).json(data ? data.data : null);
        }

        if (method === 'POST') {
            const { data } = req.body;
            
            // Vi sikrer os, at vi faktisk har fået noget data at gemme
            if (!data) return res.status(400).json({ error: 'No data provided to save' });

            const { error } = await supabase
                .from('rooms')
                .upsert({ id: room, data: data, updated_at: new Date() });

            if (error) throw error;
            return res.status(200).json({ success: true });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(405).end();
}