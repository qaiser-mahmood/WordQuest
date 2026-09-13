/* WordQuest Main Game Controller */
import { canFormWordFromWheel } from './dictionary.js';
import { SoundManager } from './sound.js';
import { startConfetti, clearConfetti } from './confetti.js';
import { generateLevel } from './grid.js';
import { saveGameState, loadGameState, getTitleForScore, getRankIndex } from './storage.js';
import { getWordDefinition } from './definitions.js';

/* ==================== STATE ==================== */
let currentLevelIdx = 0;
let score = 0;
let stars = 0;
let solvedWords = new Set();
let bonusWords = new Set();
let currentLevelData = null;
let recentRoots = [];
let previousScore = 0;
let currentRankTitle = "🌟 NOVICE";

let isSwiping = false;
let selectedNodeIndices = [];
let currentPointerPos = { x: 0, y: 0 };
let currentWheelLetters = [];
let toastTimeout = null;
let defBubbleTimeout = null;

const soundManager = new SoundManager();

const SCENIC_THEMES = [
    { id: 'theme-clouds', name: 'Day Clouds' },
    { id: 'theme-sunrise', name: 'Golden Sunrise' },
    { id: 'theme-sunset', name: 'Pink Sunset' },
    { id: 'theme-blossom', name: 'Cherry Blossom' }
];

/* ==================== DOM ELEMENTS ==================== */
const gameContainer = document.getElementById('game-container');
const scenicBg = document.getElementById('scenic-bg');
const scenicDecor = document.getElementById('scenic-decor');
const crosswordContainer = document.getElementById('crossword-container');
const crosswordGrid = document.getElementById('crossword-grid');
const wheelWrapper = document.getElementById('wheel-wrapper');
const svgCanvas = document.getElementById('svg-canvas');
const wordPreview = document.getElementById('word-preview');
const toastEl = document.getElementById('toast');
const levelBadge = document.getElementById('level-badge');
const diffBadge = document.getElementById('diff-badge');
const scoreBadge = document.getElementById('score-badge');
const playerTitleBadge = document.getElementById('player-title-badge');
const btnSound = document.getElementById('btn-sound');
const btnBonusJar = document.getElementById('btn-bonus-jar');
const btnHint = document.getElementById('btn-hint');
const btnSkip = document.getElementById('btn-skip');
const btnShuffle = document.getElementById('btn-shuffle');

const defBubble = document.getElementById('def-bubble');
const defBubbleWord = document.getElementById('def-bubble-word');
const defBubblePos = document.getElementById('def-bubble-pos');
const defBubbleText = document.getElementById('def-bubble-text');
const btnCloseDefBubble = document.getElementById('btn-close-def-bubble');

const confettiCanvas = document.getElementById('confetti-canvas');
const winModal = document.getElementById('win-modal');
const btnNextLevel = document.getElementById('btn-next-level');
const starShopModal = document.getElementById('star-shop-modal');
const btnCloseStarShop = document.getElementById('btn-close-star-shop');
const starShopBalance = document.getElementById('star-shop-balance');
const bonusWordsList = document.getElementById('bonus-words-list');
const skipConfirmModal = document.getElementById('skip-confirm-modal');
const btnConfirmSkip = document.getElementById('btn-confirm-skip');
const btnCancelSkip = document.getElementById('btn-cancel-skip');
const rankUpModal = document.getElementById('rank-up-modal');
const btnCloseRankUp = document.getElementById('btn-close-rank-up');
const rankUpSubtitle = document.getElementById('rank-up-subtitle');
const levelStartOverlay = document.getElementById('level-start-overlay');
const startLevelTitle = document.getElementById('start-level-title');
const startDiffTag = document.getElementById('start-diff-tag');

/* Star Perk Buttons */
const btnPerkLetter = document.getElementById('btn-perk-letter');
const btnPerkPinpoint = document.getElementById('btn-perk-pinpoint');
const btnPerkSolveWord = document.getElementById('btn-perk-solve-word');
const btnPerkTheme = document.getElementById('btn-perk-theme');

/* Word Definition Popup Bubble */
function showWordDefinitionBubble(word) {
    if (!defBubble || !word) return;
    const info = getWordDefinition(word);
    if (!info) return;

    clearTimeout(defBubbleTimeout);
    defBubbleWord.textContent = word.toUpperCase();
    defBubblePos.textContent = info.pos || 'word';
    defBubbleText.textContent = info.def;

    defBubble.classList.add('show');
    defBubbleTimeout = setTimeout(() => {
        hideWordDefinitionBubble();
    }, 4500);
}

function hideWordDefinitionBubble() {
    clearTimeout(defBubbleTimeout);
    if (defBubble) defBubble.classList.remove('show');
}

/* ==================== INITIALIZATION ==================== */
export function init() {
    loadProgress();
    setupEventListeners();
    loadLevel(currentLevelIdx);

    window.addEventListener('resize', () => {
        if (currentLevelData) renderCrosswordGrid();
    });
}

function saveProgress() {
    saveGameState({
        levelIdx: currentLevelIdx,
        score,
        stars,
        recentRoots,
        solvedWords,
        bonusWords,
        levelData: currentLevelData,
        soundEnabled: soundManager.enabled
    });
}

function loadProgress() {
    const saved = loadGameState();
    if (saved) {
        currentLevelIdx = saved.levelIdx;
        score = saved.score;
        stars = saved.stars;
        recentRoots = saved.recentRoots;
        solvedWords = saved.solvedWords;
        bonusWords = saved.bonusWords;
        currentLevelData = saved.levelData;
        soundManager.enabled = saved.soundEnabled;
        btnSound.textContent = soundManager.enabled ? '🔊' : '🔇';

        // If saved level was already completely solved, advance to next level!
        if (currentLevelData && currentLevelData.words && currentLevelData.words.length > 0) {
            const allSolved = currentLevelData.words.every(w => solvedWords.has(w.word));
            if (allSolved) {
                currentLevelIdx++;
                currentLevelData = null;
                solvedWords.clear();
                bonusWords.clear();
            }
        }
    }

    currentRankTitle = getTitleForScore(score);
    previousScore = score;
    updateScoreDisplay();
    updateStarDisplay();
}

/* ==================== SCORE & STAR DISPLAYS ==================== */
function updateScoreDisplay() {
    scoreBadge.textContent = "🏆 " + score;
    checkRankPromotion(score);
    previousScore = score;
}

function updateStarDisplay() {
    btnBonusJar.textContent = "⭐ " + stars;
    if (starShopBalance) starShopBalance.textContent = "⭐ " + stars;
    updateStarShopButtonStates();
}

function updateStarShopButtonStates() {
    if (btnPerkLetter) btnPerkLetter.disabled = stars < 3;
    if (btnPerkPinpoint) btnPerkPinpoint.disabled = stars < 5;
    if (btnPerkSolveWord) btnPerkSolveWord.disabled = stars < 8;
}

function checkRankPromotion(newScore) {
    const newTitle = getTitleForScore(newScore);

    if (currentRankTitle && newTitle !== currentRankTitle) {
        const oldRankIdx = getRankIndex(previousScore);
        const newRankIdx = getRankIndex(newScore);

        const modalTitle = rankUpModal.querySelector('.modal-title');
        const modalIcon = rankUpModal.querySelector('.rank-up-icon');
        const rankCard = rankUpModal.querySelector('.rank-up-card');

        if (newRankIdx > oldRankIdx) {
            modalIcon.textContent = "🌟";
            modalTitle.textContent = "RANK UP!";
            modalTitle.style.color = "#7e22ce";
            rankUpSubtitle.textContent = "Congratulations! You have reached:\n" + newTitle;
            rankUpSubtitle.style.color = "#1e293b";
            btnCloseRankUp.textContent = "AWESOME!";
            btnCloseRankUp.style.background = "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)";
            rankCard.style.borderColor = "#c084fc";
            rankCard.style.boxShadow = "0 10px 35px rgba(168, 85, 247, 0.35)";
        } else {
            modalIcon.textContent = "📉";
            modalTitle.textContent = "RANK DEMOTION";
            modalTitle.style.color = "#dc2626";
            rankUpSubtitle.textContent = "Your score dropped. You are now:\n" + newTitle;
            rankUpSubtitle.style.color = "#475569";
            btnCloseRankUp.textContent = "I'LL RECOVER!";
            btnCloseRankUp.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
            rankCard.style.borderColor = "#ef4444";
            rankCard.style.boxShadow = "0 10px 35px rgba(239, 68, 68, 0.35)";
        }

        rankUpModal.classList.add('active');
    }

    currentRankTitle = newTitle;
    playerTitleBadge.textContent = currentRankTitle;
}

/* ==================== LEVEL MANAGEMENT ==================== */
function loadLevel(idx) {
    if (idx !== currentLevelIdx || !currentLevelData) {
        currentLevelIdx = idx;
        solvedWords.clear();
        bonusWords.clear();
        currentLevelData = generateLevel(currentLevelIdx + 1, recentRoots);
        recentRoots.push(currentLevelData.rootWord);
        if (recentRoots.length > 25) recentRoots.shift();
    }

    applyLevelTheme(currentLevelIdx + 1);
    levelBadge.textContent = "LVL " + (currentLevelIdx + 1);
    diffBadge.textContent = currentLevelData.difficulty;
    diffBadge.className = "difficulty-badge " + (currentLevelData.diffClass || "diff-easy");

    showLevelStartOverlay(currentLevelIdx + 1, currentLevelData.difficulty, currentLevelData.diffClass);
    renderCrosswordGrid();
    renderWheel(true); // Always force fresh wheel letters matching currentLevelData
    saveProgress();
}

function showLevelStartOverlay(lvlNum, diff, diffClass) {
    startLevelTitle.textContent = "LEVEL " + lvlNum;
    startDiffTag.textContent = diff;
    startDiffTag.className = "difficulty-badge " + (diffClass || "diff-easy");
    levelStartOverlay.classList.add('active');

    setTimeout(() => {
        levelStartOverlay.classList.remove('active');
    }, 1200);
}

function applyLevelTheme(lvl) {
    SCENIC_THEMES.forEach(t => scenicBg.classList.remove(t.id));
    const theme = SCENIC_THEMES[(lvl - 1) % SCENIC_THEMES.length];
    scenicBg.classList.add(theme.id);
}

function findWordForTiles(keys) {
    if (!currentLevelData || !keys || keys.length === 0) return null;
    const firstKey = keys[0];
    const [r0, c0] = firstKey.split(',').map(Number);

    const candidates = currentLevelData.words.filter(wObj => {
        if (!solvedWords.has(wObj.word)) return false;
        for (let i = 0; i < wObj.word.length; i++) {
            const r = wObj.dir === 'V' ? wObj.row + i : wObj.row;
            const c = wObj.dir === 'H' ? wObj.col + i : wObj.col;
            if (r === r0 && c === c0) return true;
        }
        return false;
    });

    if (candidates.length === 0) return null;
    if (candidates.length === 1 || keys.length === 1) return candidates[0];

    const secondKey = keys[1];
    const [r1, c1] = secondKey.split(',').map(Number);
    const isHorizontal = r0 === r1;
    const match = candidates.find(c => isHorizontal ? c.dir === 'H' : c.dir === 'V');
    return match || candidates[0];
}

let isGridSwiping = false;
let gridSwipedKeys = [];

function handleGridPointerDown(e) {
    const tile = e.target.closest('.tile.solved');
    if (tile) {
        isGridSwiping = true;
        gridSwipedKeys = [tile.dataset.key];
    }
}

function handleGridPointerMove(e) {
    if (!isGridSwiping) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tile = el ? el.closest('.tile.solved') : null;
    if (tile && !gridSwipedKeys.includes(tile.dataset.key)) {
        gridSwipedKeys.push(tile.dataset.key);
    }
}

function handleGridPointerEnd() {
    if (!isGridSwiping) return;
    isGridSwiping = false;
    if (gridSwipedKeys.length > 0) {
        const matched = findWordForTiles(gridSwipedKeys);
        if (matched) {
            showWordDefinitionBubble(matched.word);
            highlightAlreadySolved(matched);
        }
    }
    gridSwipedKeys = [];
}

/* ==================== CROSSWORD GRID RENDERING ==================== */
function renderCrosswordGrid() {
    crosswordGrid.innerHTML = '';
    if (!currentLevelData) return;

    const { gridWidth, gridHeight, words } = currentLevelData;

    const containerW = crosswordContainer.clientWidth || 340;
    const containerH = crosswordContainer.clientHeight || 260;

    const maxW = Math.max(containerW - 24, 260);
    const maxH = Math.max(containerH - 24, 200);

    const calcSizeW = (maxW - (gridWidth - 1) * 4) / gridWidth;
    const calcSizeH = (maxH - (gridHeight - 1) * 4) / gridHeight;

    // Generously sized tiles: 38px to 54px
    let tileSize = Math.floor(Math.min(calcSizeW, calcSizeH));
    tileSize = Math.min(54, Math.max(38, tileSize));

    const gap = 4;
    const totalW = gridWidth * tileSize + (gridWidth - 1) * gap;
    const totalH = gridHeight * tileSize + (gridHeight - 1) * gap;

    crosswordGrid.style.width = totalW + 'px';
    crosswordGrid.style.height = totalH + 'px';

    const cellMap = new Map();
    words.forEach(wObj => {
        const isSolved = solvedWords.has(wObj.word);
        for (let i = 0; i < wObj.word.length; i++) {
            const r = wObj.dir === "V" ? wObj.row + i : wObj.row;
            const c = wObj.dir === "H" ? wObj.col + i : wObj.col;
            const key = `${r},${c}`;

            if (!cellMap.has(key)) {
                cellMap.set(key, {
                    char: wObj.word[i],
                    r, c,
                    solved: isSolved,
                    wordRefs: [wObj.word]
                });
            } else {
                const cell = cellMap.get(key);
                if (isSolved) cell.solved = true;
                cell.wordRefs.push(wObj.word);
            }
        }
    });

    cellMap.forEach((cell, key) => {
        const tile = document.createElement('div');
        tile.className = 'tile' + (cell.solved ? ' solved' : ' unsolved');
        tile.dataset.key = key;
        tile.dataset.char = cell.char;
        tile.textContent = cell.char;
        tile.style.width = tileSize + 'px';
        tile.style.height = tileSize + 'px';
        tile.style.fontSize = Math.floor(tileSize * 0.54) + 'px';
        tile.style.top = (cell.r * (tileSize + gap)) + 'px';
        tile.style.left = (cell.c * (tileSize + gap)) + 'px';

        // Tap solved tile to see word definition bubble
        tile.addEventListener('click', (e) => {
            e.stopPropagation();
            if (tile.classList.contains('solved')) {
                const matched = findWordForTiles([tile.dataset.key]);
                if (matched) {
                    showWordDefinitionBubble(matched.word);
                    highlightAlreadySolved(matched);
                }
            }
        });

        crosswordGrid.appendChild(tile);
    });
}

/* ==================== WHEEL RENDERING ==================== */
function renderWheel(forceFresh = false) {
    wheelWrapper.querySelectorAll('.wheel-node').forEach(n => n.remove());

    // CRITICAL: Always use currentLevelData's wheel letters!
    if (forceFresh || currentWheelLetters.length !== currentLevelData.wheelLetters.length) {
        currentWheelLetters = [...currentLevelData.wheelLetters];
    }

    const totalNodes = currentWheelLetters.length;
    const radius = Math.min(wheelWrapper.clientWidth, wheelWrapper.clientHeight) * 0.385;
    const centerX = wheelWrapper.clientWidth / 2;
    const centerY = wheelWrapper.clientHeight / 2;

    currentWheelLetters.forEach((letter, idx) => {
        const angle = (idx * (2 * Math.PI / totalNodes)) - (Math.PI / 2);
        const x = centerX + radius * Math.cos(angle) - 26;
        const y = centerY + radius * Math.sin(angle) - 26;

        const node = document.createElement('div');
        node.className = 'wheel-node';
        node.textContent = letter;
        node.dataset.index = idx;
        node.dataset.letter = letter;
        node.style.left = x + 'px';
        node.style.top = y + 'px';

        wheelWrapper.appendChild(node);
    });
}

function shuffleWheel() {
    soundManager.init();
    for (let i = currentWheelLetters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentWheelLetters[i], currentWheelLetters[j]] = [currentWheelLetters[j], currentWheelLetters[i]];
    }
    renderWheel(false);
}

/* ==================== SWIPING & TOUCH HANDLERS ==================== */
function handlePointerDown(e) {
    soundManager.init();
    hideWordDefinitionBubble();
    isSwiping = true;
    selectedNodeIndices = [];
    currentPointerPos = { x: e.clientX, y: e.clientY };

    checkNodeHit(e.clientX, e.clientY);
    updatePreview();
    renderLines();
}

function handlePointerMove(e) {
    if (!isSwiping) return;
    currentPointerPos = { x: e.clientX, y: e.clientY };
    checkNodeHit(e.clientX, e.clientY);
    renderLines();
}

function handlePointerUp() {
    if (!isSwiping) return;
    isSwiping = false;

    const formedWord = selectedNodeIndices.map(i => currentWheelLetters[i]).join('');
    clearWheelSelection();
    clearLines();
    hidePreview();

    if (formedWord.length >= 3) {
        processWordSubmission(formedWord);
    }
}

function checkNodeHit(clientX, clientY) {
    const nodes = wheelWrapper.querySelectorAll('.wheel-node');
    nodes.forEach(node => {
        const rect = node.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.hypot(clientX - centerX, clientY - centerY);

        if (dist <= 28) {
            const idx = parseInt(node.dataset.index);
            if (selectedNodeIndices.length > 1 && selectedNodeIndices[selectedNodeIndices.length - 2] === idx) {
                // Backtrack
                selectedNodeIndices.pop();
                soundManager.playLetterSelect(selectedNodeIndices.length);
                updateNodeStyles();
                updatePreview();
            } else if (!selectedNodeIndices.includes(idx)) {
                selectedNodeIndices.push(idx);
                soundManager.playLetterSelect(selectedNodeIndices.length);
                updateNodeStyles();
                updatePreview();
            }
        }
    });
}

function updateNodeStyles() {
    const nodes = wheelWrapper.querySelectorAll('.wheel-node');
    nodes.forEach((n, idx) => {
        if (selectedNodeIndices.includes(idx)) {
            n.classList.add('selected');
        } else {
            n.classList.remove('selected');
        }
    });
}

function clearWheelSelection() {
    wheelWrapper.querySelectorAll('.wheel-node').forEach(n => n.classList.remove('selected'));
    selectedNodeIndices = [];
}

function updatePreview() {
    const word = selectedNodeIndices.map(i => currentWheelLetters[i]).join('');
    if (word.length > 0) {
        wordPreview.textContent = word;
        wordPreview.classList.add('visible');
    } else {
        wordPreview.classList.remove('visible');
    }
}

function hidePreview() {
    wordPreview.classList.remove('visible');
}

function renderLines() {
    svgCanvas.innerHTML = '';
    if (selectedNodeIndices.length === 0) return;

    const wrapperRect = wheelWrapper.getBoundingClientRect();

    for (let i = 0; i < selectedNodeIndices.length - 1; i++) {
        const idxA = selectedNodeIndices[i];
        const idxB = selectedNodeIndices[i + 1];
        const nodeA = wheelWrapper.querySelector(`.wheel-node[data-index="${idxA}"]`);
        const nodeB = wheelWrapper.querySelector(`.wheel-node[data-index="${idxB}"]`);

        if (nodeA && nodeB) {
            const rectA = nodeA.getBoundingClientRect();
            const rectB = nodeB.getBoundingClientRect();

            const x1 = rectA.left + rectA.width / 2 - wrapperRect.left;
            const y1 = rectA.top + rectA.height / 2 - wrapperRect.top;
            const x2 = rectB.left + rectB.width / 2 - wrapperRect.left;
            const y2 = rectB.top + rectB.height / 2 - wrapperRect.top;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            svgCanvas.appendChild(line);
        }
    }

    // Line to cursor
    if (isSwiping && selectedNodeIndices.length > 0) {
        const lastIdx = selectedNodeIndices[selectedNodeIndices.length - 1];
        const lastNode = wheelWrapper.querySelector(`.wheel-node[data-index="${lastIdx}"]`);
        if (lastNode) {
            const rect = lastNode.getBoundingClientRect();
            const x1 = rect.left + rect.width / 2 - wrapperRect.left;
            const y1 = rect.top + rect.height / 2 - wrapperRect.top;
            const x2 = currentPointerPos.x - wrapperRect.left;
            const y2 = currentPointerPos.y - wrapperRect.top;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            svgCanvas.appendChild(line);
        }
    }
}

function clearLines() {
    svgCanvas.innerHTML = '';
}

/* ==================== WORD PROCESSING ==================== */
function processWordSubmission(word) {
    if (!currentLevelData) return;

    // Check if word is on crossword board
    const matchingBoardWord = currentLevelData.words.find(w => w.word === word);

    if (matchingBoardWord) {
        if (solvedWords.has(word)) {
            soundManager.playWordCorrect();
            highlightAlreadySolved(matchingBoardWord);
            showWordDefinitionBubble(word);
            showToast(`${word} (Solved)`, "already");
        } else {
            // Newly solved crossword word!
            solvedWords.add(word);
            const pointsEarned = word.length * 100;
            score += pointsEarned;
            updateScoreDisplay();

            soundManager.playWordCorrect();
            animateWordSolved(matchingBoardWord);
            spawnFloatingScore(pointsEarned, false);
            showToast(`+${pointsEarned} Pts!`, "correct");
            saveProgress();

            setTimeout(checkLevelCompletion, 500);
        }
        return;
    }

    // Check if it's a bonus word
    if (currentLevelData.allSeedWords && currentLevelData.allSeedWords.includes(word)) {
        if (bonusWords.has(word)) {
            soundManager.playWordCorrect();
            showWordDefinitionBubble(word);
            showToast(`${word} (Bonus)`, "bonus");
        } else {
            bonusWords.add(word);
            stars += 1;
            score += 50;
            updateScoreDisplay();
            updateStarDisplay();

            soundManager.playBonusWord();
            spawnFloatingScore("+1 ⭐", true);
            showToast("Bonus Word +1 ⭐!", "bonus");
            saveProgress();
        }
        return;
    }

    // Invalid word
    soundManager.playWordWrong();
    showToast("Not In Puzzle", "wrong");
}

function highlightAlreadySolved(wordObj) {
    for (let i = 0; i < wordObj.word.length; i++) {
        const r = wordObj.dir === "V" ? wordObj.row + i : wordObj.row;
        const c = wordObj.dir === "H" ? wordObj.col + i : wordObj.col;
        const tile = crosswordGrid.querySelector(`.tile[data-key="${r},${c}"]`);
        if (tile) {
            tile.classList.add('already-highlight');
            setTimeout(() => tile.classList.remove('already-highlight'), 600);
        }
    }
}

function animateWordSolved(wordObj) {
    const containerRect = gameContainer.getBoundingClientRect();

    for (let i = 0; i < wordObj.word.length; i++) {
        const r = wordObj.dir === "V" ? wordObj.row + i : wordObj.row;
        const c = wordObj.dir === "H" ? wordObj.col + i : wordObj.col;
        const char = wordObj.word[i];

        const targetTile = crosswordGrid.querySelector(`.tile[data-key="${r},${c}"]`);
        if (!targetTile) continue;

        const targetRect = targetTile.getBoundingClientRect();
        const endX = targetRect.left - containerRect.left;
        const endY = targetRect.top - containerRect.top;

        // Flying tile animation from wheel to target cell
        const flyEl = document.createElement('div');
        flyEl.className = 'flying-tile';
        flyEl.textContent = char;
        flyEl.style.width = targetRect.width + 'px';
        flyEl.style.height = targetRect.height + 'px';
        flyEl.style.fontSize = targetTile.style.fontSize;

        const wheelRect = wheelWrapper.getBoundingClientRect();
        const startX = wheelRect.left + wheelRect.width / 2 - targetRect.width / 2 - containerRect.left;
        const startY = wheelRect.top + wheelRect.height / 2 - targetRect.height / 2 - containerRect.top;

        flyEl.style.left = startX + 'px';
        flyEl.style.top = startY + 'px';
        gameContainer.appendChild(flyEl);

        setTimeout(() => {
            flyEl.style.left = endX + 'px';
            flyEl.style.top = endY + 'px';
        }, 20 + i * 50);

        setTimeout(() => {
            flyEl.remove();
            targetTile.classList.remove('unsolved');
            targetTile.classList.add('solved');
        }, 460 + i * 50);
    }
}

function spawnFloatingScore(text, isBonus) {
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-score' + (isBonus ? ' bonus-float' : '');
    floatEl.textContent = text;
    floatEl.style.left = (wheelWrapper.offsetLeft + wheelWrapper.clientWidth / 2 - 25) + 'px';
    floatEl.style.top = (wheelWrapper.offsetTop + 20) + 'px';
    gameContainer.appendChild(floatEl);

    setTimeout(() => floatEl.remove(), 850);
}

function checkLevelCompletion() {
    if (!currentLevelData) return;
    const allWordsSolved = currentLevelData.words.every(wObj => solvedWords.has(wObj.word));

    if (allWordsSolved) {
        soundManager.playLevelWinFanfare();
        startConfetti(confettiCanvas);

        setTimeout(() => {
            document.getElementById('win-subtitle').textContent =
                `Level ${currentLevelIdx + 1} Cleared!\nTotal Score: 🏆 ${score}  |  Bonus Stars: ⭐ ${stars}`;
            winModal.classList.add('active');
        }, 500);
    }
}

/* ==================== HINTS & STAR SHOP ==================== */
function handleScoreHint() {
    soundManager.init();
    if (score < 250) {
        showToast("Need 250 Cups for Hint!", "wrong");
        soundManager.playWordWrong();
        return;
    }

    const unsolvedTiles = Array.from(crosswordGrid.querySelectorAll('.tile.unsolved:not(.revealed-hint)'));
    if (unsolvedTiles.length === 0) {
        showToast("All Tiles Solved!", "info");
        return;
    }

    score -= 250;
    updateScoreDisplay();
    soundManager.playHint();

    const randomTile = unsolvedTiles[Math.floor(Math.random() * unsolvedTiles.length)];
    randomTile.classList.add('revealed-hint');
    showToast("Hint Revealed! (-250 Cups)", "info");
    saveProgress();
}

function openStarShopModal() {
    soundManager.init();
    updateStarDisplay();
    bonusWordsList.innerHTML = '';

    if (bonusWords.size === 0) {
        bonusWordsList.innerHTML = '<div style="color: #64748b; font-size: 12px; padding: 8px;">No bonus words found yet this level! Form words not on the grid to earn bonus ⭐ stars.</div>';
    } else {
        Array.from(bonusWords).forEach(w => {
            const chip = document.createElement('div');
            chip.className = 'bonus-word-chip';
            chip.textContent = w;
            chip.style.cursor = 'pointer';
            chip.title = 'Tap to see meaning';
            chip.addEventListener('click', () => {
                starShopModal.classList.remove('active');
                showWordDefinitionBubble(w);
            });
            bonusWordsList.appendChild(chip);
        });
    }

    starShopModal.classList.add('active');
}

function buyPerkLetter() {
    if (stars < 3) return;
    const unsolvedTiles = Array.from(crosswordGrid.querySelectorAll('.tile.unsolved:not(.revealed-hint)'));
    if (unsolvedTiles.length === 0) {
        showToast("Board Already Solved!", "info");
        return;
    }

    stars -= 3;
    updateStarDisplay();
    soundManager.playHint();

    const randomTile = unsolvedTiles[Math.floor(Math.random() * unsolvedTiles.length)];
    randomTile.classList.add('revealed-hint');
    showToast("Letter Revealed! (-3 ⭐)", "info");
    saveProgress();
    starShopModal.classList.remove('active');
}

function buyPerkPinpoint() {
    if (stars < 5) return;
    // Find longest unsolved word and reveal its first unsolved tile
    const unsolvedWords = currentLevelData.words
        .filter(w => !solvedWords.has(w.word))
        .sort((a, b) => b.word.length - a.word.length);

    if (unsolvedWords.length === 0) {
        showToast("Board Already Solved!", "info");
        return;
    }

    const targetWord = unsolvedWords[0];
    let revealed = false;

    for (let i = 0; i < targetWord.word.length; i++) {
        const r = targetWord.dir === "V" ? targetWord.row + i : targetWord.row;
        const c = targetWord.dir === "H" ? targetWord.col + i : targetWord.col;
        const tile = crosswordGrid.querySelector(`.tile[data-key="${r},${c}"].unsolved`);
        if (tile) {
            tile.classList.add('revealed-hint');
            revealed = true;
            break;
        }
    }

    if (revealed) {
        stars -= 5;
        updateStarDisplay();
        soundManager.playHint();
        showToast("Target Letter Revealed! (-5 ⭐)", "info");
        saveProgress();
        starShopModal.classList.remove('active');
    }
}

function buyPerkSolveWord() {
    if (stars < 8) return;
    const unsolvedWords = currentLevelData.words.filter(w => !solvedWords.has(w.word));
    if (unsolvedWords.length === 0) {
        showToast("Board Already Solved!", "info");
        return;
    }

    const wordToSolve = unsolvedWords[0];
    stars -= 8;
    updateStarDisplay();

    soundManager.playWordCorrect();
    solvedWords.add(wordToSolve.word);
    animateWordSolved(wordToSolve);
    showToast(`Word Solved: ${wordToSolve.word}! (-8 ⭐)`, "bonus");
    saveProgress();
    starShopModal.classList.remove('active');

    setTimeout(checkLevelCompletion, 500);
}

function cycleScenicTheme() {
    soundManager.init();
    const currentThemeIdx = SCENIC_THEMES.findIndex(t => scenicBg.classList.contains(t.id));
    const nextIdx = (currentThemeIdx + 1) % SCENIC_THEMES.length;
    SCENIC_THEMES.forEach(t => scenicBg.classList.remove(t.id));
    scenicBg.classList.add(SCENIC_THEMES[nextIdx].id);
    showToast(`Theme: ${SCENIC_THEMES[nextIdx].name}`, "info");
}

function showToast(msg, type) {
    clearTimeout(toastTimeout);
    toastEl.textContent = msg;
    toastEl.className = "toast " + type + " show";
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

/* ==================== EVENT LISTENERS ==================== */
function setupEventListeners() {
    btnSound.addEventListener('click', () => {
        soundManager.init();
        soundManager.enabled = !soundManager.enabled;
        btnSound.textContent = soundManager.enabled ? '🔊' : '🔇';
        saveProgress();
    });

    btnShuffle.addEventListener('click', shuffleWheel);
    btnHint.addEventListener('click', handleScoreHint);
    btnBonusJar.addEventListener('click', openStarShopModal);

    btnSkip.addEventListener('click', () => {
        skipConfirmModal.classList.add('active');
    });

    btnCancelSkip.addEventListener('click', () => {
        skipConfirmModal.classList.remove('active');
    });

    btnConfirmSkip.addEventListener('click', () => {
        skipConfirmModal.classList.remove('active');
        clearConfetti(confettiCanvas);
        currentLevelData = null;
        loadLevel(currentLevelIdx + 1);
    });

    btnNextLevel.addEventListener('click', () => {
        winModal.classList.remove('active');
        clearConfetti(confettiCanvas);
        currentLevelData = null;
        loadLevel(currentLevelIdx + 1);
    });

    btnCloseStarShop.addEventListener('click', () => {
        starShopModal.classList.remove('active');
    });

    btnCloseRankUp.addEventListener('click', () => {
        rankUpModal.classList.remove('active');
    });

    if (btnCloseDefBubble) {
        btnCloseDefBubble.addEventListener('click', hideWordDefinitionBubble);
    }

    if (btnPerkLetter) btnPerkLetter.addEventListener('click', buyPerkLetter);
    if (btnPerkPinpoint) btnPerkPinpoint.addEventListener('click', buyPerkPinpoint);
    if (btnPerkSolveWord) btnPerkSolveWord.addEventListener('click', buyPerkSolveWord);
    if (btnPerkTheme) btnPerkTheme.addEventListener('click', cycleScenicTheme);

    // Touch and pointer interactions for wheel
    wheelWrapper.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    // Crossword grid swiping to inspect solved words
    crosswordContainer.addEventListener('pointerdown', handleGridPointerDown);
    crosswordContainer.addEventListener('pointermove', handleGridPointerMove);
    window.addEventListener('pointerup', handleGridPointerEnd);
    window.addEventListener('pointercancel', handleGridPointerEnd);

    // Touch outside definition bubble to dismiss it immediately
    window.addEventListener('pointerdown', (e) => {
        if (defBubble && defBubble.classList.contains('show')) {
            if (!defBubble.contains(e.target) && !e.target.closest('.tile.solved') && !e.target.closest('.bonus-word-chip')) {
                hideWordDefinitionBubble();
            }
        }
    }, true);
}

// Auto-start on load
window.addEventListener('DOMContentLoaded', init);
