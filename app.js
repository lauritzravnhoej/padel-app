const PLAYERS = ["Lau", "Hein", "Lopper", "Hoppe"];
const API_BASE_URL = '/api/database'; 
let roomCode = null;

const MATCH_SCHEDULE = [
    { t1: [0, 1], t2: [2, 3] }, { t1: [0, 2], t2: [1, 3] },
    { t1: [0, 3], t2: [1, 2] }, { t1: [1, 2], t2: [0, 3] },
    { t1: [1, 3], t2: [0, 2] }, { t1: [2, 3], t2: [0, 1] }
];

let appState = {
    history: [],
    currentRound: {
        matches: MATCH_SCHEDULE.map(m => ({ ...m, score1: 0, score2: 0 })),
        faults: [0, 0, 0, 0]
    }
};

// --- Database ---
async function fetchRoomData() {
    if (!roomCode) return;
    try {
        const response = await fetch(`${API_BASE_URL}?room=${roomCode}`);
        if (response.ok) {
            const data = await response.json();
            if (data) {
                appState = data;
            } else {
                // Nyt rum - vi nulstiller appState til standard
                appState = {
                    history: [],
                    currentRound: {
                        matches: MATCH_SCHEDULE.map(m => ({ ...m, score1: 0, score2: 0 })),
                        faults: [0, 0, 0, 0]
                    }
                };
            }
            // render() SKAL kaldes herude, så siden tegnes uanset hvad
            render();
        }
    } catch (error) {
        console.error('Fejl ved hentning:', error);
    }
}

async function saveState() {
    if (!roomCode) { render(); return; }
    try {
        await fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: roomCode, data: appState })
        });
        render();
    } catch (error) {
        console.error('Fejl ved gem:', error);
    }
}

// --- Statistik Logik ---
function getPlayerStats() {
    const stats = PLAYERS.map(name => ({
        name, wins: 0, losses: 0, gamesWon: 0, faults: 0, roundsLost: 0
    }));

    appState.history.forEach(round => {
        round.faults.forEach((f, i) => stats[i].faults += (parseInt(f) || 0));
        const loserIdx = PLAYERS.indexOf(round.loserName);
        if (loserIdx !== -1) stats[loserIdx].roundsLost++;

        round.matches.forEach(m => {
            const s1 = parseInt(m.score1) || 0;
            const s2 = parseInt(m.score2) || 0;
            m.t1.forEach(p => { 
                stats[p].gamesWon += s1;
                if (s1 > s2) stats[p].wins++; else if (s2 > s1) stats[p].losses++;
            });
            m.t2.forEach(p => { 
                stats[p].gamesWon += s2;
                if (s2 > s1) stats[p].wins++; else if (s1 > s2) stats[p].losses++;
            });
        });
    });
    return stats;
}

function calculateRoundLoser(matches) {
    const res = PLAYERS.map((_, i) => ({ index: i, wins: 0, games: 0 }));
    matches.forEach(m => {
        const s1 = parseInt(m.score1) || 0;
        const s2 = parseInt(m.score2) || 0;
        m.t1.forEach(p => { res[p].games += s1; if(s1 > s2) res[p].wins++; });
        m.t2.forEach(p => { res[p].games += s2; if(s2 > s1) res[p].wins++; });
    });
    // Tie-breaker: Færrest sejre -> Færrest partier
    res.sort((a, b) => a.wins !== b.wins ? a.wins - b.wins : a.games - b.games);
    return { name: PLAYERS[res[0].index] };
}

// --- Rendering ---
function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    const stats = getPlayerStats();
    tbody.innerHTML = stats.map(p => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4 font-bold text-slate-700">${p.name}</td>
            <td class="p-4 text-center text-red-500 font-bold">${p.roundsLost}</td>
            <td class="p-4 text-center text-orange-500 font-medium">${p.faults}</td>
            <td class="p-4 text-center">${p.wins} / ${p.losses}</td>
            <td class="p-4 text-center font-mono">${p.gamesWon}</td>
        </tr>
    `).join('');
}

function renderActiveRound() {
    const list = document.getElementById('match-list');
    list.innerHTML = appState.currentRound.matches.map((m, i) => `
        <div class="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div class="flex-1 text-right pr-4 text-sm font-semibold text-slate-600">${PLAYERS[m.t1[0]]} & ${PLAYERS[m.t1[1]]}</div>
            <div class="flex items-center gap-2">
                <input type="number" data-index="${i}" data-team="1" value="${m.score1 || ''}" class="score-input w-12 h-12 text-center border-2 border-gray-200 rounded-lg font-bold text-slate-800 focus:border-blue-500 outline-none">
                <span class="text-gray-300">-</span>
                <input type="number" data-index="${i}" data-team="2" value="${m.score2 || ''}" class="score-input w-12 h-12 text-center border-2 border-gray-200 rounded-lg font-bold text-slate-800 focus:border-blue-500 outline-none">
            </div>
            <div class="flex-1 text-left pl-4 text-sm font-semibold text-slate-600">${PLAYERS[m.t2[0]]} & ${PLAYERS[m.t2[1]]}</div>
        </div>
    `).join('');

    const faultsDiv = document.getElementById('faults-inputs');
    faultsDiv.innerHTML = PLAYERS.map((name, i) => `
        <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-slate-500 uppercase">${name}</label>
            <input type="number" data-player="${i}" value="${appState.currentRound.faults[i] || ''}" class="fault-input p-2 bg-white border border-gray-200 rounded-lg text-center font-bold text-orange-600">
        </div>
    `).join('');
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (appState.history.length === 0) {
        list.innerHTML = '<p class="text-slate-400 text-center py-4">Ingen runder endnu.</p>';
        return;
    }
    list.innerHTML = [...appState.history].reverse().map(round => `
        <div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs text-slate-400">${new Date(round.date).toLocaleString()}</span>
                <span class="bg-red-100 text-red-600 text-[10px] px-2 py-1 rounded-full font-bold uppercase">Taber: ${round.loserName}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-[10px]">
                ${round.matches.map(m => `
                    <div class="bg-white p-1 rounded border border-gray-100 text-center">
                        <div class="font-bold text-slate-700">${m.score1} - ${m.score2}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function render() {
    renderLeaderboard();
    renderActiveRound();
    renderHistory();
}

// --- Listeners ---
document.getElementById('join-room-btn').addEventListener('click', () => {
    const input = document.getElementById('room-code-input').value.trim();
    if (input) { roomCode = input; fetchRoomData(); alert(`Logget ind i: ${roomCode}`); }
});

document.body.addEventListener('input', (e) => {
    if (e.target.classList.contains('score-input')) {
        const { index, team } = e.target.dataset;
        appState.currentRound.matches[index][`score${team}`] = e.target.value;
        saveState();
    }
    if (e.target.classList.contains('fault-input')) {
        appState.currentRound.faults[e.target.dataset.player] = e.target.value;
        saveState();
    }
});

document.getElementById('finish-round-btn').addEventListener('click', () => {
    if (!confirm("Afslut runden?")) return;
    const roundLoser = calculateRoundLoser(appState.currentRound.matches);
    appState.history.push({
        id: Date.now(),
        date: new Date().toISOString(),
        matches: JSON.parse(JSON.stringify(appState.currentRound.matches)),
        faults: [...appState.currentRound.faults],
        loserName: roundLoser.name
    });
    appState.currentRound = {
        matches: MATCH_SCHEDULE.map(m => ({ ...m, score1: 0, score2: 0 })),
        faults: [0, 0, 0, 0]
    };
    saveState();
});

document.getElementById('test-fill-btn').addEventListener('click', () => {
    appState.currentRound.matches.forEach(m => {
        m.score1 = Math.floor(Math.random() * 7);
        m.score2 = Math.floor(Math.random() * 7);
    });
    saveState();
});

// Nuke
document.getElementById('nuke-data-btn').addEventListener('click', () => {
    if(confirm("SLET ALT DATA?")) {
        appState.history = [];
        saveState();
    }
});

render();