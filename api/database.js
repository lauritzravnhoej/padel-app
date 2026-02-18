import { createClient } from '@supabase/supabase-js';

// Vi bruger de navne, jeg kan se på dit Vercel-screenshot
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

// Vi tilføjer et tjek her. Hvis de er tomme, kaster vi en fejl vi kan se i loggen.
if (!supabaseUrl || !supabaseKey) {
    throw new Error("Mangler Supabase URL eller Service Role Key i Environment Variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    const { method } = req;
    const { room } = req.query || req.body;

    if (!room) return res.status(400).json({ error: 'Room code required' });

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
            const { error } = await supabase
                .from('rooms')
                .upsert({ id: room, data: data, updated_at: new Date() });

            if (error) throw error;
            return res.status(200).json({ success: true });
        }
    } catch (error) {
        // Dette sender den faktiske fejlbesked tilbage til din konsol
        return res.status(500).json({ error: error.message });
    }

    return res.status(405).end();
}