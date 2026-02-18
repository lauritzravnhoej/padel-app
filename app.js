// --- Configuration ---
const PLAYERS = ["Lau", "Hein", "Lopper", "Hoppe"];
let roomCode = null; // Room code for shared data
const API_BASE_URL = '/api/kv'; // Vercel KV API base URL

// Standard 4-player combinations (Round Robin variation)
// Indices map to PLAYERS array. [Team A P1, Team A P2] vs [Team B P1, Team B P2]
const MATCH_SCHEDULE = [
    { t1: [0, 1], t2: [2, 3] }, // P1+P2 vs P3+P4
    { t1: [0, 2], t2: [1, 3] }, // P1+P3 vs P2+P4
    { t1: [0, 3], t2: [1, 2] }, // P1+P4 vs P2+P3
    { t1: [1, 2], t2: [0, 3] }, // P2+P3 vs P1+P4 (Repeat matchup logic but switch partners effectively covers everyone)
    { t1: [1, 3], t2: [0, 2] },
    { t1: [2, 3], t2: [0, 1] }
];
// Actually, for a strict 4-player 3-round setup (everyone pairs once), it's usually 3 matches. 
// But prompt requests "6 matches where everyone plays with everyone else twice". The schedule above works for that.

// --- State Management ---
let appState = {
    history: [],
    currentRound: {
        matches: MATCH_SCHEDULE.map(m => ({ ...m, score1: 0, score2: 0 })),
        faults: [0, 0, 0, 0]
    }
};

// Fetch data from Vercel KV
async function fetchRoomData() {
    if (!roomCode) return;
    try {
        const response = await fetch(`${API_BASE_URL}/get?room=${roomCode}`);
        if (response.ok) {
            const data = await response.json();
            if (data) {
                appState = data;
                render();
            }
        } else {
            console.error('Failed to fetch room data:', response.statusText);
        }
    } catch (error) {
        console.error('Error fetching room data:', error);
    }
}

// Save data to Vercel KV
async function saveRoomData() {
    if (!roomCode) return;
    try {
        const response = await fetch(`${API_BASE_URL}/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: roomCode, data: appState })
        });
        if (!response.ok) {
            console.error('Failed to save room data:', response.statusText);
        }
    } catch (error) {
        console.error('Error saving room data:', error);
    }
}

// Override saveState to use Vercel KV
function saveState() {
    saveRoomData();
    render();
}

function resetCurrentRound() {
    appState.currentRound = {
        matches: MATCH_SCHEDULE.map(m => ({ ...m, score1: 0, score2: 0 })),
        faults: [0, 0, 0, 0]
    };
    // Ensure inputs are cleared visually if not re-rendered immediately
    document.querySelectorAll('input').forEach(i => i.value = '');
}

// --- Logic ---

function getPlayerStats() {
    // Initialize stats
    const stats = PLAYERS.map(name => ({
        name,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        faults: 0,
        roundsLost: 0
    }));

    // Process History
    appState.history.forEach(round => {
        // Add round faults
        round.faults.forEach((count, pIndex) => stats[pIndex].faults += (parseInt(count) || 0));
        
        // Add round loser
        if (round.loserIndex !== -1) {
            stats[round.loserIndex].roundsLost++;
        }

        // Add match stats
        round.matches.forEach(m => {
            const team1Won = parseInt(m.score1) > parseInt(m.score2);
            const team2Won = parseInt(m.score2) > parseInt(m.score1);
            
            // Team 1 Stats
            m.t1.forEach(pIndex => {
                stats[pIndex].gamesWon += parseInt(m.score1) || 0;
                if (team1Won) stats[pIndex].wins++;
                if (team2Won) stats[pIndex].losses++;
            });

            // Team 2 Stats
            m.t2.forEach(pIndex => {
                stats[pIndex].gamesWon += parseInt(m.score2) || 0;
                if (team2Won) stats[pIndex].wins++;
                if (team1Won) stats[pIndex].losses++;
            });
        });
    });

    return stats;
}

function calculateRoundLoser(matches = [], faults = []) {
    // Temporary stats for just this calculation
    const currentStats = PLAYERS.map((_, i) => ({ index: i, wins: 0, games: 0 }));

    matches.forEach(m => {
        const s1 = parseInt(m.score1) || 0;
        const s2 = parseInt(m.score2) || 0;

        m.t1.forEach(pIndex => {
            currentStats[pIndex].games += s1;
            if (s1 > s2) currentStats[pIndex].wins++;
        });
        m.t2.forEach(pIndex => {
            currentStats[pIndex].games += s2;
            if (s2 > s1) currentStats[pIndex].wins++;
        });
    });

    // Sort: Fewest Wins -> Fewest Games
    // We want the "worst" player at index 0 of sorted array
    currentStats.sort((a, b) => {
        if (a.wins !== b.wins) return a.wins - b.wins; // Ascending wins
        return a.games - b.games; // Ascending games
    });

    // Valid check: if all 0, no result yet
    const totalGamesPlayed = matches.reduce((acc, m) => acc + (parseInt(m.score1) || 0) + (parseInt(m.score2) || 0), 0);
    if (totalGamesPlayed === 0) return { loserIndex: -1, name: "N/A" };

    return { loserIndex: currentStats[0].index, name: PLAYERS[currentStats[0].index] };
}

// --- Rendering ---

function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    const stats = getPlayerStats();
    
    // Sort logic needed for display? Maybe standard order or by best performance?
    // Let's keep fixed order for consistency with inputs, or sort by lowest rounds lost (best player)
    // stats.sort((a,b) => a.roundsLost - b.roundsLost); 

    tbody.innerHTML = stats.map(p => `
        <tr class="hover:bg-blue-50/50 transition-colors group">
            <td class="p-4 font-bold text-slate-700">${p.name}</td>
            <td class="p-4 text-center">
                <span class="${p.roundsLost > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'} px-3 py-1 rounded-full font-bold text-xs">
                    ${p.roundsLost}
                </span>
            </td>
            <td class="p-4 text-center text-slate-500 font-medium">${p.faults}</td>
            <td class="p-4 text-center text-sm">
                <span class="text-emerald-600 font-bold">${p.wins}</span> 
                <span class="text-gray-300 mx-1">|</span> 
                <span class="text-red-400 font-bold">${p.losses}</span>
            </td>
            <td class="p-4 text-center font-mono text-slate-600">${p.gamesWon}</td>
        </tr>
    `).join('');
}

function renderActiveRound() {
    const container = document.getElementById('match-list');
    container.innerHTML = '';

    appState.currentRound.matches.forEach((match, index) => {
        const team1Names = match.t1.map(i => PLAYERS[i]).join(" & ");
        const team2Names = match.t2.map(i => PLAYERS[i]).join(" & ");

        const html = `
            <div class="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex-1 text-right pr-4 text-sm font-medium text-slate-600 leading-tight">${team1Names}</div>
                <div class="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <input type="number" min="0" max="7" 
                        class="w-10 h-10 text-lg text-center font-bold bg-white border border-gray-200 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all score-input text-slate-700" 
                        data-index="${index}" data-team="1" 
                        placeholder="-"
                        value="${match.score1 == 0 && match.score2 == 0 ? '' : match.score1}">
                    <span class="text-gray-300 font-light">vs</span>
                    <input type="number" min="0" max="7" 
                        class="w-10 h-10 text-lg text-center font-bold bg-white border border-gray-200 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all score-input text-slate-700" 
                        data-index="${index}" data-team="2" 
                        placeholder="-"
                        value="${match.score2 == 0 && match.score1 == 0 ? '' : match.score2}">
                </div>
                <div class="flex-1 text-left pl-4 text-sm font-medium text-slate-600 leading-tight">${team2Names}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });

    // Fault Inputs
    const faultContainer = document.getElementById('faults-inputs');
    faultContainer.innerHTML = PLAYERS.map((name, i) => `
        <div class="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-200/60">
            <label class="text-xs font-bold text-slate-500 ml-2">${name}</label>
            <input type="number" min="0" 
                class="w-12 py-1 text-center bg-orange-50/50 border-orange-100 text-orange-800 rounded font-medium focus:ring-orange-200 fault-input outline-none focus:ring-2 transition-all" 
                data-player="${i}"
                placeholder="0"
                value="${appState.currentRound.faults[i] || ''}">
        </div>
    `).join('');
}

// helper: return up to 2-letter initials
function getInitials(name) {
	if (!name || typeof name !== 'string') return '';
	return name.split(' ').map(n => n[0] || '').join('').slice(0,2).toUpperCase();
}

// prettier history rendering with names per match and faults summary
function renderHistory() {
	const list = document.getElementById('history-list');
	if (!appState.history || appState.history.length === 0) {
		list.innerHTML = '<p class="text-slate-400 text-center py-6 text-sm italic">No rounds played yet.</p>';
		return;
	}

	const rounds = [...appState.history].slice().reverse();
	list.innerHTML = rounds.map(round => {
		// build matches HTML: show team names, scores, highlight winner
		const matchesHtml = round.matches.map(m => {
			const team1 = m.t1.map(i => PLAYERS[i]).join(' & ');
			const team2 = m.t2.map(i => PLAYERS[i]).join(' & ');
			const s1 = parseInt(m.score1) || 0;
			const s2 = parseInt(m.score2) || 0;
			const winner = s1 > s2 ? 1 : s2 > s1 ? 2 : 0;

			return `
				<div class="p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
					<div class="text-xs text-slate-400 mb-1">${team1}</div>
					<div class="flex items-center justify-between gap-4">
						<div class="text-lg font-bold ${winner === 1 ? 'text-emerald-600' : 'text-slate-700'}">${s1}</div>
						<div class="text-xs text-gray-300">—</div>
						<div class="text-lg font-bold ${winner === 2 ? 'text-emerald-600' : 'text-slate-700'}">${s2}</div>
					</div>
					<div class="text-xs text-slate-400 mt-1 text-right">${team2}</div>
				</div>
			`;
		}).join('');

		// build faults HTML: initials, name, faults
		const faultsHtml = PLAYERS.map((name, i) => {
			const f = round.faults && (round.faults[i] !== undefined) ? round.faults[i] : 0;
			return `
				<div class="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-100">
					<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-purple-400 to-blue-400">
						${getInitials(name)}
					</div>
					<div class="text-xs text-slate-700">${name}</div>
					<div class="ml-auto text-sm font-bold text-orange-500">${f}</div>
				</div>
			`;
		}).join('');

		return `
			<div class="p-5 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-all">
				<div class="flex justify-between items-start mb-4">
					<div>
						<div class="text-slate-800 font-bold text-sm">Round #${round.id.toString().slice(-4)}</div>
						<div class="text-slate-400 text-xs">${new Date(round.date).toLocaleString()}</div>
					</div>
					<div class="text-right">
						<div class="text-[10px] text-slate-400 uppercase tracking-wide">Round Loser</div>
						<div class="bg-red-50 text-red-600 border border-red-100 text-xs px-3 py-1 rounded-full font-bold mt-1">${round.loserName}</div>
					</div>
				</div>

				<div class="grid grid-cols-3 gap-3 mb-4">
					${matchesHtml}
				</div>

				<div class="pt-3 border-t border-slate-100">
					<div class="flex items-center justify-between mb-3">
						<div class="text-xs text-slate-500 uppercase tracking-wide">Double Faults</div>
						<div class="text-xs text-slate-400">per player</div>
					</div>
					<div class="grid grid-cols-2 gap-2">
						${faultsHtml}
					</div>
				</div>

				<div class="text-right mt-4">
					<button data-round-id="${round.id}" class="edit-round-btn text-xs font-semibold text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded transition inline-flex items-center gap-2">
						<span>Edit</span>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
					</button>
				</div>
			</div>
		`;
	}).join('');

	// Attach click handlers to edit buttons
	list.querySelectorAll('.edit-round-btn').forEach(btn => {
		btn.addEventListener('click', (ev) => {
			const id = btn.getAttribute('data-round-id');
			editRound(Number(id));
		});
	});
}

function render() {
    renderLeaderboard();
    renderActiveRound();
    renderHistory();
}

// Global function for editing a round
function editRound(roundId) {
    // Check if current active round has data entered
    const isDirty = appState.currentRound.matches.some(m => m.score1 > 0 || m.score2 > 0);
    
    if (isDirty) {
        if (!confirm("Your current active round has unsaved scores. Editing a history item will overwrite this. Continue?")) {
            return;
        }
    }

    // Find round in history
    const roundIndex = appState.history.findIndex(r => r.id === roundId);
    if (roundIndex === -1) return;

    const roundToEdit = appState.history[roundIndex];

    // Remove from history (it moves to active)
    appState.history.splice(roundIndex, 1);

    // Set as active (deep copy to avoid reference issues)
    appState.currentRound = JSON.parse(JSON.stringify(roundToEdit));

    saveState();
    
    // Scroll to top
    document.getElementById('active-round').scrollIntoView({ behavior: 'smooth' });
    alert("Round loaded for editing. Make your changes and click 'Complete Round' when done.");
}

// --- Event Listeners ---

document.body.addEventListener('input', (e) => {
    // Handle Match Score Input
    if (e.target.classList.contains('score-input')) {
        const matchIndex = e.target.dataset.index;
        const team = e.target.dataset.team; // '1' or '2'
        const val = e.target.value;
        appState.currentRound.matches[matchIndex][`score${team}`] = val;
        saveState(); // Auto-save
    }
    
    // Handle Fault Input
    if (e.target.classList.contains('fault-input')) {
        const playerIndex = e.target.dataset.player;
        appState.currentRound.faults[playerIndex] = e.target.value;
        saveState();
    }
});

document.getElementById('finish-round-btn').addEventListener('click', () => {
    // Validation
    const allMatchesPlayed = appState.currentRound.matches.every(m => 
        (m.score1 > 0 || m.score2 > 0) && (m.score1 != m.score2) // Basic check: no empty 0-0 or draws usually
    );
    
    if (!confirm("Are you sure you want to finish this round?")) return;

    const roundLoser = calculateRoundLoser(appState.currentRound.matches);
    
    // Archive Round
    const completedRound = {
        date: appState.currentRound.date || new Date().toISOString(), // Preserve date if editing, else new
        matches: appState.currentRound.matches,
        faults: appState.currentRound.faults,
        loserIndex: roundLoser.loserIndex,
        loserName: roundLoser.name,
        id: appState.currentRound.id || Date.now() // Preserve ID if editing
    };

    appState.history.push(completedRound);
    
    // Sort history by date to keep order correct if editing old rounds
    appState.history.sort((a, b) => new Date(a.date) - new Date(b.date));

    resetCurrentRound();
    saveState();
    alert(`Round saved! The loser was: ${roundLoser.name}`);
});

document.getElementById('nuke-data-btn').addEventListener('click', () => {
    if(confirm("DELETE EVERYTHING? This cannot be undone.")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
});

// --- Test Utilities ---
document.getElementById('test-fill-btn').addEventListener('click', () => {
    // Fill matches with valid random scores (e.g., 6-4, 7-5, 2-6)
    appState.currentRound.matches.forEach(m => {
        // Randomly decide winner
        const team1Win = Math.random() > 0.5;
        const winnerScore = Math.random() > 0.5 ? 6 : 7;
        const loserScore = Math.floor(Math.random() * (winnerScore - 1)); // Ensure valid loss

        m.score1 = team1Win ? winnerScore : loserScore;
        m.score2 = team1Win ? loserScore : winnerScore;
    });

    // Fill faults randomly (0 to 3)
    appState.currentRound.faults = appState.currentRound.faults.map(() => Math.floor(Math.random() * 4));

    saveState();
    alert("Random scores generated! Click 'Complete Round' to finish.");
});

// Init
loadState();
render();
