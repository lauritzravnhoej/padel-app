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

        if (method === 'PATCH') {
            const { roundId, matchIndex, updatedMatch } = req.body;

            if (!roundId || matchIndex === undefined || !updatedMatch) {
                return res.status(400).json({ error: 'Missing roundId, matchIndex, or updatedMatch' });
            }

            const { data, error } = await supabase
                .from('rooms')
                .select('data')
                .eq('id', room)
                .single();

            if (error) throw error;

            if (!data || !data.data) {
                return res.status(404).json({ error: 'Room not found' });
            }

            const appState = data.data;

            // Find runden og opdater match
            const round = appState.history.find(r => String(r.id) === String(roundId));
            if (!round) {
                return res.status(404).json({ error: 'Round not found' });
            }

            if (!round.matches[matchIndex]) {
                return res.status(404).json({ error: 'Match not found in the specified round' });
            }

            round.matches[matchIndex] = { ...round.matches[matchIndex], ...updatedMatch };

            // --- GENBEREGN TABEREN FOR RUNDEN ---
            // Brug samme logik som i frontend
            const PLAYERS = ["Lau", "Hein", "Lopper", "Hoppe"];
            const res = PLAYERS.map((_, i) => ({ index: i, wins: 0, games: 0, faults: round.faults ? (parseInt(round.faults[i]) || 0) : 0 }));
            round.matches.forEach(m => {
                const s1 = parseInt(m.score1) || 0;
                const s2 = parseInt(m.score2) || 0;
                m.t1.forEach(p => { res[p].games += s1; if (s1 > s2) res[p].wins++; });
                m.t2.forEach(p => { res[p].games += s2; if (s2 > s1) res[p].wins++; });
            });
            res.sort((a, b) =>
                a.wins !== b.wins ? a.wins - b.wins :
                a.games !== b.games ? a.games - b.games :
                b.faults - a.faults
            );
            round.loserName = PLAYERS[res[0].index];
            // --- SLUT GENBEREGNING ---

            // Gem den opdaterede appState
            const { error: updateError } = await supabase
                .from('rooms')
                .update({ data: appState, updated_at: new Date() })
                .eq('id', room);

            if (updateError) throw updateError;

            return res.status(200).json({ success: true });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(405).end();
}