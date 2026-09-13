/* WordQuest Storage & Player Progression Engine */

export const RANK_THRESHOLDS = [
    { minScore: 120000, title: "👑 GRAND MASTER" },
    { minScore: 65000,  title: "🏆 CHAMPION" },
    { minScore: 35000,  title: "🎯 EXPERT" },
    { minScore: 18000,  title: "💡 WORDSMITH" },
    { minScore: 7500,   title: "🧭 EXPLORER" },
    { minScore: 2500,   title: "🔍 SEEKER" },
    { minScore: -Infinity, title: "🌟 NOVICE" }
];

export function getRankIndex(currentScore) {
    for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
        if (currentScore >= RANK_THRESHOLDS[i].minScore) {
            return RANK_THRESHOLDS.length - 1 - i;
        }
    }
    return 0;
}

export function getTitleForScore(currentScore) {
    for (let item of RANK_THRESHOLDS) {
        if (currentScore >= item.minScore) return item.title;
    }
    return "🌟 NOVICE";
}

const STORAGE_KEY = 'wordquest_save_v6';

export function saveGameState(state) {
    try {
        const payload = {
            levelIdx: state.levelIdx,
            score: state.score,
            stars: state.stars,
            recentRoots: state.recentRoots || [],
            solvedWords: Array.from(state.solvedWords || []),
            bonusWords: Array.from(state.bonusWords || []),
            levelData: state.levelData,
            soundEnabled: state.soundEnabled !== undefined ? state.soundEnabled : true
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('Unable to save game state to localStorage:', e);
    }
}

export function loadGameState() {
    const raw = localStorage.getItem(STORAGE_KEY) ||
                localStorage.getItem('wordquest_save_v5') ||
                localStorage.getItem('wordquest_save_v4');
    if (!raw) return null;

    try {
        const data = JSON.parse(raw);
        return {
            levelIdx: typeof data.levelIdx === 'number' ? data.levelIdx : 0,
            score: typeof data.score === 'number' ? data.score : 0,
            stars: typeof data.stars === 'number' ? data.stars : (data.bonus ? data.bonus.length : 0),
            recentRoots: Array.isArray(data.recentRoots) ? data.recentRoots : [],
            solvedWords: new Set(data.solvedWords || data.solved || []),
            bonusWords: new Set(data.bonusWords || data.bonus || []),
            levelData: data.levelData || null,
            soundEnabled: data.soundEnabled !== undefined ? data.soundEnabled : true
        };
    } catch (e) {
        console.warn('Unable to parse saved game state:', e);
        return null;
    }
}
