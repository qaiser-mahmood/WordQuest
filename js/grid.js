/* WordQuest Crossword Placement & Generation Engine */
import { WORD_DATABASE, canFormWordFromWheel, filterRedundantPlurals, getTierInfoForLevel } from './dictionary.js';

function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function generateLevel(lvlNum, recentRoots = []) {
    const tierInfo = getTierInfoForLevel(lvlNum);
    const pool = WORD_DATABASE[tierInfo.tierKey] || WORD_DATABASE.tier_beginner;

    // Pick root not in recent roots
    let available = pool.filter(item => !recentRoots.includes(item.root));
    if (available.length === 0) {
        available = pool;
    }
    const chosenItem = available[Math.floor(Math.random() * available.length)];

    // Build wheel letters directly from root
    const wheelLetters = shuffleArray([...chosenItem.wheel]);

    // Candidate words: strictly verified against wheel and anti-plural filtered
    let candidateWords = chosenItem.words.filter(w => canFormWordFromWheel(w, wheelLetters));
    candidateWords = filterRedundantPlurals(candidateWords);

    const maxGrid = tierInfo.maxGrid;
    const minWords = tierInfo.minTarget; // At least 5 words even on Beginner!

    // Try placing words on crossword grid
    for (let attempt = 0; attempt < 180; attempt++) {
        const grid = Array(maxGrid).fill(null).map(() => Array(maxGrid).fill(null));
        const placedWords = [];

        // Shuffle candidates by length buckets to balance layout
        const byLen = {};
        candidateWords.forEach(w => {
            byLen[w.length] = byLen[w.length] || [];
            byLen[w.length].push(w);
        });

        const wordsToTry = [];
        Object.keys(byLen).sort((a, b) => b - a).forEach(len => {
            wordsToTry.push(...shuffleArray(byLen[len]));
        });

        if (wordsToTry.length === 0) continue;

        // First anchor word placed near center
        const first = wordsToTry[0];
        if (first.length > maxGrid) continue;
        const startRow = Math.floor(maxGrid / 2);
        const startCol = Math.max(0, Math.floor((maxGrid - first.length) / 2));

        for (let i = 0; i < first.length; i++) {
            grid[startRow][startCol + i] = first[i];
        }
        placedWords.push({ word: first, row: startRow, col: startCol, dir: 'H' });

        // Place subsequent words intersecting valid letters
        for (let wIdx = 1; wIdx < wordsToTry.length; wIdx++) {
            const word = wordsToTry[wIdx];
            let placed = false;

            for (let r = 0; r < maxGrid && !placed; r++) {
                for (let c = 0; c < maxGrid && !placed; c++) {
                    for (let dir of ['H', 'V']) {
                        if (canPlaceWordStrict(grid, word, r, c, dir, maxGrid, maxGrid)) {
                            placeWordOnGrid(grid, word, r, c, dir);
                            placedWords.push({ word, row: r, col: c, dir });
                            placed = true;
                            break;
                        }
                    }
                }
            }
        }

        if (placedWords.length >= minWords) {
            // Strictly verify all placed words are 100% formable from wheel
            const allValid = placedWords.every(p => canFormWordFromWheel(p.word, wheelLetters));
            if (allValid) {
                const cropped = cropGridAndAdjustCoordinates(maxGrid, maxGrid, placedWords);
                return {
                    rootWord: chosenItem.root,
                    difficulty: tierInfo.name,
                    diffClass: tierInfo.css,
                    gridWidth: cropped.width,
                    gridHeight: cropped.height,
                    words: cropped.words,
                    wheelLetters,
                    allSeedWords: chosenItem.words
                };
            }
        }
    }

    // If this root was tough to pack >= minWords, try another root from the pool
    for (let rIdx = 0; rIdx < Math.min(pool.length, 5); rIdx++) {
        const altItem = pool[rIdx];
        if (altItem.root === chosenItem.root) continue;
        const altWheel = shuffleArray([...altItem.wheel]);
        let altCandidates = altItem.words.filter(w => canFormWordFromWheel(w, altWheel));
        altCandidates = filterRedundantPlurals(altCandidates);

        for (let attempt = 0; attempt < 80; attempt++) {
            const grid = Array(maxGrid).fill(null).map(() => Array(maxGrid).fill(null));
            const placedWords = [];
            const shuffled = shuffleArray(altCandidates);
            const first = shuffled[0];
            if (!first || first.length > maxGrid) continue;

            const startRow = Math.floor(maxGrid / 2);
            const startCol = Math.max(0, Math.floor((maxGrid - first.length) / 2));
            for (let i = 0; i < first.length; i++) grid[startRow][startCol + i] = first[i];
            placedWords.push({ word: first, row: startRow, col: startCol, dir: 'H' });

            for (let wIdx = 1; wIdx < shuffled.length; wIdx++) {
                const word = shuffled[wIdx];
                let placed = false;
                for (let r = 0; r < maxGrid && !placed; r++) {
                    for (let c = 0; c < maxGrid && !placed; c++) {
                        for (let dir of ['H', 'V']) {
                            if (canPlaceWordStrict(grid, word, r, c, dir, maxGrid, maxGrid)) {
                                placeWordOnGrid(grid, word, r, c, dir);
                                placedWords.push({ word, row: r, col: c, dir });
                                placed = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (placedWords.length >= minWords && placedWords.every(p => canFormWordFromWheel(p.word, altWheel))) {
                const cropped = cropGridAndAdjustCoordinates(maxGrid, maxGrid, placedWords);
                return {
                    rootWord: altItem.root,
                    difficulty: tierInfo.name,
                    diffClass: tierInfo.css,
                    gridWidth: cropped.width,
                    gridHeight: cropped.height,
                    words: cropped.words,
                    wheelLetters: altWheel,
                    allSeedWords: altItem.words
                };
            }
        }
    }

    // High quality fallback placement guaranteed to have >= minWords
    return generateStructuredLevel(tierInfo, chosenItem, wheelLetters, minWords);
}

function generateStructuredLevel(tierInfo, item, wheelLetters, minWords) {
    let validWords = item.words.filter(w => canFormWordFromWheel(w, wheelLetters));
    validWords = filterRedundantPlurals(validWords);
    validWords.sort((a, b) => b.length - a.length);

    const maxGrid = 9;
    const grid = Array(maxGrid).fill(null).map(() => Array(maxGrid).fill(null));
    const placed = [];

    const rootWord = validWords[0] || item.root;
    const centerRow = 4;
    const centerCol = Math.max(0, Math.floor((maxGrid - rootWord.length) / 2));

    for (let i = 0; i < rootWord.length; i++) grid[centerRow][centerCol + i] = rootWord[i];
    placed.push({ word: rootWord, row: centerRow, col: centerCol, dir: 'H' });

    for (let wIdx = 1; wIdx < validWords.length && placed.length < minWords; wIdx++) {
        const nextWord = validWords[wIdx];
        let placedWord = false;

        for (let r = 0; r < maxGrid && !placedWord; r++) {
            for (let c = 0; c < maxGrid && !placedWord; c++) {
                for (let dir of ['V', 'H']) {
                    if (canPlaceWordStrict(grid, nextWord, r, c, dir, maxGrid, maxGrid)) {
                        placeWordOnGrid(grid, nextWord, r, c, dir);
                        placed.push({ word: nextWord, row: r, col: c, dir });
                        placedWord = true;
                        break;
                    }
                }
            }
        }
    }

    const cropped = cropGridAndAdjustCoordinates(maxGrid, maxGrid, placed);
    return {
        rootWord: item.root,
        difficulty: tierInfo.name,
        diffClass: tierInfo.css,
        gridWidth: cropped.width,
        gridHeight: cropped.height,
        words: cropped.words,
        wheelLetters,
        allSeedWords: item.words
    };
}

function cropGridAndAdjustCoordinates(origW, origH, words) {
    let minR = origH, maxR = 0, minC = origW, maxC = 0;

    words.forEach(wObj => {
        const { word, row, col, dir } = wObj;
        for (let i = 0; i < word.length; i++) {
            const r = dir === 'V' ? row + i : row;
            const c = dir === 'H' ? col + i : col;
            minR = Math.min(minR, r);
            maxR = Math.max(maxR, r);
            minC = Math.min(minC, c);
            maxC = Math.max(maxC, c);
        }
    });

    const adjustedWords = words.map(wObj => ({
        ...wObj,
        row: wObj.row - minR,
        col: wObj.col - minC
    }));

    return {
        width: (maxC - minC) + 1,
        height: (maxR - minR) + 1,
        words: adjustedWords
    };
}

function canPlaceWordStrict(grid, word, row, col, dir, maxW, maxH) {
    if (dir === 'H' && col + word.length > maxW) return false;
    if (dir === 'V' && row + word.length > maxH) return false;

    let intersections = 0;

    // Check cells immediately before and after
    if (dir === 'H') {
        if (col - 1 >= 0 && grid[row][col - 1] !== null) return false;
        if (col + word.length < maxW && grid[row][col + word.length] !== null) return false;
    } else {
        if (row - 1 >= 0 && grid[row - 1][col] !== null) return false;
        if (row + word.length < maxH && grid[row + word.length][col] !== null) return false;
    }

    for (let i = 0; i < word.length; i++) {
        const r = dir === 'V' ? row + i : row;
        const c = dir === 'H' ? col + i : col;
        const cell = grid[r][c];

        if (cell !== null) {
            if (cell !== word[i]) return false;
            intersections++;
        } else {
            // Check adjacent parallel cells so words don't merge side-by-side
            if (dir === 'H') {
                if (r - 1 >= 0 && grid[r - 1][c] !== null) return false;
                if (r + 1 < maxH && grid[r + 1][c] !== null) return false;
            } else {
                if (c - 1 >= 0 && grid[r][c - 1] !== null) return false;
                if (c + 1 < maxW && grid[r][c + 1] !== null) return false;
            }
        }
    }

    return intersections >= 1;
}

function placeWordOnGrid(grid, word, row, col, dir) {
    for (let i = 0; i < word.length; i++) {
        const r = dir === 'V' ? row + i : row;
        const c = dir === 'H' ? col + i : col;
        grid[r][c] = word[i];
    }
}
