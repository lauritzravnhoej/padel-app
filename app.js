const PLAYERS = ["Lau", "Hein", "Lopper", "Hoppe"];
const API_BASE_URL = '/api/database'; // Rettet sti til din Vercel function
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

// --- Database Funktioner ---

async function fetchRoomData() {
    if (!roomCode) return;
    try {
        const response = await fetch(`${API_BASE_URL}?room=${roomCode}`);
        if (response.ok) {
            const data = await response.json();
            if (data) {
                appState = data;
                render();
            }
        }
    } catch (error) {
        console.error('Kunne ikke hente data:', error);
    }
}

async function saveState() {
    if (!roomCode) {
        render(); // Vis bare lokalt hvis man ikke er i et rum
        return;
    }
    try {
        await fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: roomCode, data: appState })
        });
        render();
    } catch (error) {
        console.error('Kunne ikke gemme data:', error);
    }
}

// --- Event Listeners ---

document.getElementById('join-room-btn').addEventListener('click', () => {
    const input = document.getElementById('room-code-input').value.trim();
    if (input) {
        roomCode = input;
        fetchRoomData();
        alert(`Forbundet til rum: ${roomCode}`);
    }
});

// Opdaterer scores løbende
document.body.addEventListener('input', (e) => {
    if (e.target.classList.contains('score-input')) {
        const { index, team } = e.target.dataset;
        appState.currentRound.matches[index][`score${team}`] = e.target.value;
        saveState();
    }
    if (e.target.classList.contains('fault-input')) {
        const playerIndex = e.target.dataset.player;
        appState.currentRound.faults[playerIndex] = e.target.value;
        saveState();
    }
});

// Færdiggør runde
document.getElementById('finish-round-btn').addEventListener('click', () => {
    if (!confirm("Er runden slut?")) return;

    const roundLoser = calculateRoundLoser(appState.currentRound.matches);
    const completedRound = {
        id: Date.now(),
        date: new Date().toISOString(),
        matches: [...appState.currentRound.matches],
        faults: [...appState.currentRound.faults],
        loserName: roundLoser.name
    };

    appState.history.push(completedRound);
    appState.currentRound = {
        matches: MATCH_SCHEDULE.map(m => ({ ...m, score1: 0, score2: 0 })),
        faults: [0, 0, 0, 0]
    };

    saveState();
});

// --- Hjælpefunktioner til Beregning & Render ---

function calculateRoundLoser(matches) {
    const scores = PLAYERS.map((_, i) => ({ index: i, wins: 0, games: 0 }));
    matches.forEach(m => {
        const s1 = parseInt(m.score1) || 0;
        const s2 = parseInt(m.score2) || 0;
        m.t1.forEach(p => { scores[p].games += s1; if(s1 > s2) scores[p].wins++; });
        m.t2.forEach(p => { scores[p].games += s2; if(s2 > s1) scores[p].wins++; });
    });
    scores.sort((a, b) => a.wins !== b.wins ? a.wins - b.wins : a.games - b.games);
    return { name: PLAYERS[scores[0].index] };
}

// (Her indsættes dine render-funktioner fra den tidligere kode: renderLeaderboard, renderActiveRound osv.)
function render() {
    renderLeaderboard();
    renderActiveRound();
    renderHistory();
}

// Start
render();