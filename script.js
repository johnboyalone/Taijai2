document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIG ---
    const TIME_LIMIT = 20;
    const MY_PLAYER_ID = 1;
    const INITIAL_ELIMINATION_TRIES = 3;

    // --- DOM ELEMENTS ---
    const dom = {
        screens: {
            welcome: document.getElementById('welcome-screen'),
            setup: document.getElementById('setup-screen'),
            game: document.getElementById('game-screen'),
            gameOver: document.getElementById('game-over-screen'),
        },
        buttons: {
            showSetup: document.getElementById('show-setup-btn'),
            startGame: document.getElementById('start-game-btn'),
            restartGame: document.getElementById('restart-game-btn'),
            eliminate: document.getElementById('eliminate-btn'),
            popupHistory: document.getElementById('popup-history-btn'),
        },
        setup: {
            playerCountSelector: document.getElementById('player-count-selector'),
            digitCountSelector: document.getElementById('digit-count-selector'),
        },
        game: {
            mainStatusText: document.getElementById('main-status-text'),
            subStatusText: document.getElementById('sub-status-text'),
            playersBar: document.getElementById('players-bar'),
            mySecretNumberArea: document.getElementById('my-secret-number-area'),
            mySecretNumberDisplay: document.getElementById('my-secret-number-display'),
            timerBar: document.getElementById('timer-bar'),
            guessDisplay: document.getElementById('guess-display'),
            keypad: document.getElementById('keypad'),
            shoutGuessDisplay: document.getElementById('shout-guess-display'),
            energyBeamSvg: document.getElementById('energy-beam-svg'),
            energyBeamPath: document.getElementById('energy-beam-path'),
        },
        gameOver: {
            winnerAnnouncement: document.getElementById('winner-announcement'),
            winnerName: document.getElementById('winner-name'),
            winnerSecretNumber: document.getElementById('winner-secret-number'),
            epithetReveal: document.getElementById('epithet-reveal'),
            epithetCardDisplay: document.getElementById('epithet-card-display'),
            epithetPlayerName: document.querySelector('#epithet-card-display .epithet-player-name'),
            epithetTitle: document.querySelector('#epithet-card-display .epithet-title'),
            epithetIcon: document.querySelector('#epithet-card-display .epithet-icon'),
            epithetDescription: document.querySelector('#epithet-card-display .epithet-description'),
            nextPromptEpithet: document.querySelector('#epithet-reveal .next-prompt'),
            statsContainer: document.getElementById('stats-container'),
            statsTableBody: document.getElementById('stats-table-body'),
        },
        popup: {
            overlay: document.getElementById('history-popup-overlay'),
            popup: document.getElementById('history-popup'),
            filterButtons: document.getElementById('history-filter-buttons'),
            list: document.getElementById('history-popup-list'),
            previewText: document.querySelector('#popup-history-btn .preview-text'),
            icon: document.querySelector('#popup-history-btn .icon'),
        }
    };

    // --- GAME STATE ---
    let state = {};
    let timerInterval;
    let isSecretNumberVisible = true;
    let myLastThreeGuesses = [];
    let selectedPlayerCount = 2;
    let selectedDigitCount = 4;
    let eliminationCounter = 0;
    let gameOverStep = 0;
    let isAdvancingGameOver = false; // Flag to prevent multiple clicks

    // --- HELPER FUNCTIONS ---
    function generateSecretNumber(digitCount) {
        let digits = [];
        while (digits.length < digitCount) {
            const digit = Math.floor(Math.random() * 10);
            if (digits.indexOf(digit) === -1) {
                digits.push(digit);
            }
        }
        return digits.join('');
    }

    function checkGuess(guess, secret) {
        let strikes = 0;
        let balls = 0;
        let guessChars = guess.split('');
        let secretChars = secret.split('');
        for (let i = guessChars.length - 1; i >= 0; i--) {
            if (guessChars[i] === secretChars[i]) {
                strikes++;
                guessChars.splice(i, 1);
                secretChars.splice(i, 1);
            }
        }
        for (let i = 0; i < guessChars.length; i++) {
            const foundIndex = secretChars.indexOf(guessChars[i]);
            if (foundIndex !== -1) {
                balls++;
                secretChars.splice(foundIndex, 1);
            }
        }
        return { strikes, balls };
    }

    // --- STATE MANAGEMENT ---
    function createInitialState() {
        return {
            players: [], histories: {}, activePlayerIds: [],
            roundTargetIndex: -1, guesserQueue: [], currentGuesserId: null,
            currentGuess: "", isGameOver: false, winner: null, digitCount: 4,
        };
    }

    function initializeState(playerCount, digitCount) {
        state = createInitialState();
        state.digitCount = digitCount;
        for (let i = 1; i <= playerCount; i++) {
            state.players.push({
                id: i, name: `ผู้เล่น ${i}`, secretNumber: generateSecretNumber(digitCount),
                isEliminated: false, eliminationTries: INITIAL_ELIMINATION_TRIES,
                totalStrikes: 0, totalBalls: 0, totalStrikesTaken: 0,
                eliminationsMade: 0, timesAsTarget: 0, orderOfElimination: 0, epithet: null,
            });
        }
        state.histories = { [MY_PLAYER_ID]: {} };
    }

    // --- UI FUNCTIONS ---
    function showScreen(screenElement) {
        Object.values(dom.screens).forEach(s => s.classList.add('hidden'));
        screenElement.classList.remove('hidden');
        if (screenElement === dom.screens.game) {
            dom.buttons.popupHistory.classList.remove('hidden');
        } else {
            dom.buttons.popupHistory.classList.add('hidden');
        }
    }

    function updateSecretNumberDisplay() {
        if (!state.players || state.players.length === 0) return;
        const myPlayer = state.players.find(p => p.id === MY_PLAYER_ID);
        dom.game.mySecretNumberDisplay.textContent = isSecretNumberVisible ? myPlayer.secretNumber : "*".repeat(state.digitCount);
    }

    function shoutGuess(guess, guesserElement) {
        const shoutBox = dom.game.shoutGuessDisplay;
        shoutBox.textContent = guess;
        const guesserRect = guesserElement.getBoundingClientRect();
        const containerRect = dom.game.playersBar.getBoundingClientRect();
        
        const leftPos = guesserRect.left - containerRect.left + (guesserRect.width / 2);
        const topPos = guesserRect.top - containerRect.top + (guesserRect.height / 2);

        shoutBox.style.left = `${leftPos}px`;
        shoutBox.style.top = `${topPos}px`;
        
        shoutBox.classList.remove('hidden');
        shoutBox.classList.add('animate');
        
        setTimeout(() => {
            shoutBox.classList.remove('animate');
            shoutBox.classList.add('hidden');
        }, 1800);
    }

    function drawEnergyBeam(guesserElement, targetElement) {
        const svg = dom.game.energyBeamSvg;
        const path = dom.game.energyBeamPath;

        if (!guesserElement || !targetElement) {
            svg.classList.remove('visible');
            return;
        }

        const barRect = dom.game.playersBar.getBoundingClientRect();
        const guesserRect = guesserElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();

        const startX = guesserRect.left - barRect.left + guesserRect.width / 2;
        const startY = guesserRect.top - barRect.top + guesserRect.height / 2;

        const endX = targetRect.left - barRect.left + targetRect.width / 2;
        const endY = targetRect.top - barRect.top + targetRect.height / 2;

        const pathData = `M ${startX},${startY} L ${endX},${endY}`;
        
        path.setAttribute('d', pathData);
        svg.classList.add('visible');
    }

    function triggerSkullAnimation(targetPlayerId) {
        const skullElement = document.getElementById('elimination-skull-animation');
        const playerBox = document.querySelector(`.player-status-box[data-player-id='${targetPlayerId}']`);

        if (!playerBox) return;

        const boxRect = playerBox.getBoundingClientRect();
        const targetX = boxRect.left + (boxRect.width / 2);
        const targetY = boxRect.top + (boxRect.height / 2);

        document.documentElement.style.setProperty('--skull-target-x', `${targetX}px`);
        document.documentElement.style.setProperty('--skull-target-y', `${targetY}px`);

        skullElement.classList.remove('hidden', 'animate');
        void skullElement.offsetWidth;
        skullElement.classList.add('animate');

        setTimeout(() => {
            skullElement.classList.add('hidden');
            skullElement.classList.remove('animate');
        }, 2500);
    }

    function updateUI() {
        const { players, roundTargetIndex, currentGuesserId, digitCount } = state;
        const activePlayerIds = state.players.filter(p => !p.isEliminated).map(p => p.id);
        const target = players.find(p => p.id === activePlayerIds[roundTargetIndex]);
        const guesser = players.find(p => p.id === currentGuesserId);
        if (!target || !guesser) return;

        dom.game.mainStatusText.textContent = guesser.id === MY_PLAYER_ID ? "ตาของฉัน" : `${guesser.name} กำลังทาย`;
        dom.game.subStatusText.textContent = `เป้าหมาย: ${target.name}`;
        dom.game.guessDisplay.textContent = '-'.repeat(digitCount);
        dom.game.playersBar.innerHTML = '';
        updateSecretNumberDisplay();

        dom.game.playersBar.appendChild(dom.game.energyBeamSvg);

        players.forEach(p => {
            const playerBox = document.createElement('div');
            playerBox.className = 'player-status-box';
            playerBox.dataset.playerId = p.id;
            if (p.isEliminated) {
                playerBox.classList.add('eliminated');
            } else {
                if (p.id !== guesser.id && p.id !== target.id) {
                    playerBox.classList.add('inactive');
                }
                if (p.id === guesser.id) playerBox.classList.add('guesser');
                if (p.id === target.id) playerBox.classList.add('target');
            }
            playerBox.innerHTML = `<div class="player-name">${p.name}</div><div class="player-role">${p.isEliminated ? 'แพ้แล้ว 💀' : (p.id === target.id ? 'เป้าหมาย' : `พลังชีวิต: ${p.eliminationTries} ❤️`)}</div>`;
            dom.game.playersBar.appendChild(playerBox);
        });

        dom.game.playersBar.appendChild(dom.game.shoutGuessDisplay);

        setTimeout(() => {
            const guesserElement = document.querySelector(`.player-status-box[data-player-id='${guesser.id}']`);
            const targetElement = document.querySelector(`.player-status-box[data-player-id='${target.id}']`);
            
            drawEnergyBeam(guesserElement, targetElement);
        }, 50);

        dom.buttons.popupHistory.classList.remove('jiggle-active');
        if (guesser.id === MY_PLAYER_ID) {
            setTimeout(() => dom.buttons.popupHistory.classList.add('jiggle-active'), 100);
        }
    }
    // --- GAME FLOW ---
    function startNewRound() {
        state.activePlayerIds = state.players.filter(p => !p.isEliminated).map(p => p.id);
        if (state.activePlayerIds.length <= 1) {
            endGame();
            return;
        }
        state.roundTargetIndex = (state.roundTargetIndex + 1) % state.activePlayerIds.length;
        const targetId = state.activePlayerIds[state.roundTargetIndex];
        const targetPlayer = state.players.find(p => p.id === targetId);
        targetPlayer.timesAsTarget++;
        state.guesserQueue = state.activePlayerIds.filter(id => id !== targetId);
        runNextTurn();
    }

    function runNextTurn() {
        clearInterval(timerInterval);
        dom.game.energyBeamSvg.classList.remove('visible');
        if (state.guesserQueue.length === 0) {
            startNewRound();
            return;
        }
        state.currentGuesserId = state.guesserQueue.shift();
        state.currentGuess = "";
        updateUI();
        startTimer();
    }

    function endGame() {
        state.isGameOver = true;
        clearInterval(timerInterval);
        state.winner = state.players.find(p => !p.isEliminated) || null;
        
        state.players.forEach(p => {
            p.epithet = getEpithet(p, state.players);
        });

        gameOverStep = 1;
        showScreen(dom.screens.gameOver);
        
        Object.values(dom.gameOver).forEach(el => {
            if (el.classList && el.classList.contains('game-over-part')) {
                el.classList.add('hidden');
            }
        });
        dom.buttons.restartGame.classList.add('hidden');

        dom.gameOver.winnerAnnouncement.classList.remove('hidden');
        if (state.winner) {
            dom.gameOver.winnerName.textContent = state.winner.name;
            dom.gameOver.winnerSecretNumber.textContent = state.winner.secretNumber;
        } else {
            dom.gameOver.winnerName.textContent = "ไม่มีผู้ชนะ";
            dom.gameOver.winnerSecretNumber.textContent = "---";
        }
    }

    async function advanceGameOver() {
        if (!state.isGameOver || isAdvancingGameOver) return;
        isAdvancingGameOver = true;

        gameOverStep++;

        if (gameOverStep === 2) {
            dom.gameOver.winnerAnnouncement.classList.add('hidden');
            dom.gameOver.epithetReveal.classList.remove('hidden');
            
            await displayEpithets();
            
            dom.gameOver.nextPromptEpithet.classList.remove('hidden');

        } else if (gameOverStep === 3) {
            dom.gameOver.epithetReveal.classList.add('hidden');
            dom.gameOver.statsContainer.classList.remove('hidden');
            populateStatsTable();
            dom.buttons.restartGame.classList.remove('hidden');
        }
        isAdvancingGameOver = false;
    }

    function startTimer() {
        dom.game.timerBar.classList.remove('warning');
        dom.game.timerBar.style.transition = 'none';
        dom.game.timerBar.style.width = '100%';
        
        void dom.game.timerBar.offsetWidth; 
        
        dom.game.timerBar.style.transition = `width ${TIME_LIMIT}s linear`;
        dom.game.timerBar.style.width = '0%';
        
        timerInterval = setTimeout(handleGuess, TIME_LIMIT * 1000);
    }

    function handleGuess() {
        clearInterval(timerInterval);
        const { activePlayerIds, roundTargetIndex, currentGuesserId, currentGuess, digitCount } = state;
        const guesserId = currentGuesserId;
        const targetId = activePlayerIds[roundTargetIndex];
        const guesser = state.players.find(p => p.id === guesserId);
        const target = state.players.find(p => p.id === targetId);

        // ตรวจสอบว่าเวลาหมดโดยที่ยังไม่ได้ทาย (กรอกเลขไม่ครบ)
        if (currentGuess.length < digitCount) {
            guesser.eliminationTries--; // ลดพลังชีวิต
            updateUI(); // อัปเดต UI ให้เห็นพลังชีวิตลดทันที

            if (guesser.eliminationTries <= 0) {
                guesser.isEliminated = true;
                guesser.orderOfElimination = ++eliminationCounter;
                triggerSkullAnimation(guesser.id); // เรียกอนิเมชันแพ้
            }
            
            // ใช้ startNewRound เพื่อเริ่มรอบใหม่ทั้งหมด (อาจจะเปลี่ยนเป้าหมาย)
            setTimeout(startNewRound, 2000); 
            return; // จบการทำงานของฟังก์ชันที่นี่
        }

        // โค้ดส่วนที่เหลือจะทำงานก็ต่อเมื่อผู้เล่นกดทายเลขครบเท่านั้น
        const guess = currentGuess.padEnd(digitCount, '-');
        const result = checkGuess(guess, target.secretNumber);
        guesser.totalStrikes += result.strikes;
        guesser.totalBalls += result.balls;
        target.totalStrikesTaken += result.strikes;

        if (guesserId === MY_PLAYER_ID) {
            if (!state.histories[MY_PLAYER_ID][targetId]) state.histories[MY_PLAYER_ID][targetId] = [];
            const timestamp = Date.now();
            state.histories[MY_PLAYER_ID][targetId].push({ guess, ...result, timestamp });
            myLastThreeGuesses.unshift({ guess, ...result });
            myLastThreeGuesses = myLastThreeGuesses.slice(0, 3);
            updatePopupPreview();
        }

        const guesserElement = document.querySelector(`.player-status-box[data-player-id='${guesserId}']`);
        if (guesserElement) shoutGuess(guess, guesserElement);
        
        // ใช้ runNextTurn เพื่อให้ผู้เล่นคนถัดไปได้ทายเป้าหมายคนเดิม
        setTimeout(runNextTurn, 2000);
    }

    function handleEliminationAttempt() {
        const { activePlayerIds, roundTargetIndex, currentGuesserId, currentGuess, digitCount } = state;
        if (currentGuess.length !== digitCount) return;

        clearInterval(timerInterval);

        const guesser = state.players.find(p => p.id === currentGuesserId);
        const target = state.players.find(p => p.id === activePlayerIds[roundTargetIndex]);
        const isCorrect = currentGuess === target.secretNumber;

        if (guesser.id === MY_PLAYER_ID) {
            if (!state.histories[MY_PLAYER_ID][target.id]) state.histories[MY_PLAYER_ID][target.id] = [];
            const timestamp = Date.now();
            state.histories[MY_PLAYER_ID][target.id].push({ guess: currentGuess, strikes: isCorrect ? digitCount : 'X', balls: 'X', timestamp });
            myLastThreeGuesses.unshift({ guess: currentGuess, strikes: isCorrect ? digitCount : 'X', balls: 'X' });
            myLastThreeGuesses = myLastThreeGuesses.slice(0, 3);
            updatePopupPreview();
        }
        
        const guesserElement = document.querySelector(`.player-status-box[data-player-id='${guesser.id}']`);
        if (guesserElement) shoutGuess(currentGuess, guesserElement);
        
        setTimeout(() => {
            if (isCorrect) {
                target.isEliminated = true;
                target.orderOfElimination = ++eliminationCounter;
                guesser.eliminationsMade++;
                triggerSkullAnimation(target.id); 
            } else {
                guesser.eliminationTries--;
                updateUI(); // อัปเดตให้เห็นพลังชีวิตลด
                if (guesser.eliminationTries <= 0) {
                    guesser.isEliminated = true;
                    guesser.orderOfElimination = ++eliminationCounter;
                    triggerSkullAnimation(guesser.id);
                }
            }
            startNewRound();
        }, 2000);
    }
    // --- EPITHET & STATS LOGIC ---
    function getEpithet(player, allPlayers) {
        if (!player.isEliminated) return { title: "จอมอึดหนังเหนียว", desc: "ยืนหยัดเป็นคนสุดท้ายในสนามรบแห่งตัวเลข", icon: "🛡️" };
        if (player.eliminationsMade > 0) return { title: "มือสังหาร", desc: "ถึงจะแพ้ แต่ก็พาลากคนอื่นลงไปด้วย", icon: "⚔️" };
        if (player.totalStrikes === 0 && player.totalBalls === 0) return { title: "นักเดาสุ่ม", desc: "ทายมั่วไปหมด ไม่เคยเฉียดเลยสักครั้ง!", icon: "😵" };
        if (player.timesAsTarget > allPlayers.length / 2) return { title: "ดาราประจำเกม", desc: "ตกเป็นเป้าสายตาบ่อยกว่าใครเพื่อน", icon: "🌟" };
        if (player.eliminationTries === INITIAL_ELIMINATION_TRIES) return { title: "ผู้ถูกแช่แข็ง", desc: "แทบไม่ได้เล่นเลย โดนกำจัดก่อนจะเสียพลังชีวิต", icon: "🥶" };
        return { title: "หน่วยกล้าตาย", desc: "สู้สุดใจ แต่ก็ไปไม่ถึงฝัน", icon: "🫡" };
    }

    async function displayEpithets() {
        const sortedPlayers = [...state.players].sort((a, b) => (a.isEliminated ? 1 : -1) - (b.isEliminated ? 1 : -1) || a.orderOfElimination - b.orderOfElimination);
        const card = dom.gameOver.epithetCardDisplay;

        for (const p of sortedPlayers) {
            if (card.classList.contains('visible')) {
                 card.classList.remove('visible');
                 await new Promise(res => setTimeout(res, 400));
            }

            dom.gameOver.epithetPlayerName.textContent = p.name;
            dom.gameOver.epithetTitle.textContent = p.epithet.title;
            dom.gameOver.epithetIcon.textContent = p.epithet.icon;
            dom.gameOver.epithetDescription.textContent = p.epithet.desc;
            card.classList.toggle('winner-card', !p.isEliminated);
            
            card.classList.remove('hidden');
            card.classList.add('visible');
            
            await new Promise(res => setTimeout(res, 2500)); 
        }
        await new Promise(res => setTimeout(res, 1000));
    }

    function populateStatsTable() {
        dom.gameOver.statsTableBody.innerHTML = '';
        const sortedPlayers = [...state.players].sort((a, b) => (a.isEliminated ? 1 : -1) - (b.isEliminated ? 1 : -1) || a.orderOfElimination - b.orderOfElimination);
        sortedPlayers.forEach(p => {
            const cardWrapper = dom.gameOver.statsTableBody.insertRow().insertCell();
            const card = document.createElement('div');
            card.className = 'stats-card';
            card.classList.add(p.isEliminated ? 'loser-card' : 'winner-card');
            card.innerHTML = `
                <div class="stats-player-info">
                    <div class="stats-player-name">${p.name}</div>
                    <div class="stats-player-epithet">${p.epithet.title || 'N/A'}</div>
                    <div class="stats-player-status ${p.isEliminated ? 'loser' : 'winner'}">${p.isEliminated ? 'แพ้' : 'ชนะ'}</div>
                </div>
                <div class="stats-secret-number">เลขลับ: ${p.secretNumber}</div>
                <div class="stats-grid">
                    <div class="stats-item"><div class="stats-item-value">${p.totalStrikes}/${p.totalBalls}</div><div class="stats-item-label">ทายถูก/เพี้ยน</div></div>
                    <div class="stats-item"><div class="stats-item-value">${p.totalStrikesTaken}</div><div class="stats-item-label">ถูกทาย (ถูก)</div></div>
                    <div class="stats-item"><div class="stats-item-value">${p.eliminationsMade}</div><div class="stats-item-label">ขจัดสำเร็จ</div></div>
                </div>
            `;
            cardWrapper.appendChild(card);
        });
    }

    // --- HISTORY POPUP LOGIC ---
    function renderHistory(filterPlayerId = null) {
        dom.popup.list.innerHTML = '';
        const myHistory = state.histories[MY_PLAYER_ID];
        let allGuesses = [];
        Object.entries(myHistory).forEach(([targetId, guesses]) => {
            guesses.forEach(g => allGuesses.push({ ...g, targetId: parseInt(targetId) }));
        });
        const filtered = filterPlayerId ? allGuesses.filter(g => g.targetId === filterPlayerId) : allGuesses;
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        if (filtered.length === 0) {
            dom.popup.list.innerHTML = '<li>ยังไม่มีประวัติการทาย</li>';
            return;
        }
        filtered.forEach(h => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="history-guess-number">${h.guess}</span> <span class="history-guess-result"><span class="strike">ถูก ${h.strikes}</span><span class="ball">เพี้ยน ${h.balls}</span></span>`;
            dom.popup.list.appendChild(li);
        });
    }

    function updatePopupPreview() {
        const preview = dom.popup.previewText;
        if (myLastThreeGuesses.length === 0) {
            preview.innerHTML = '';
            dom.popup.icon.style.display = 'block';
            return;
        }
        dom.popup.icon.style.display = 'none';
        preview.innerHTML = myLastThreeGuesses.map(g =>
            `<div class="preview-line">
                <span class="guess-num">${g.guess}</span>
                <span class="guess-res"><span class="strike">T${g.strikes}</span> <span class="ball">P${g.balls}</span></span>
            </div>`
        ).join('');
    }

    // --- INITIALIZATION ---
    function initializeApp() {
        [2, 3, 4, 5, 6].forEach(num => {
            const btn = document.createElement('button');
            btn.className = 'player-count-btn';
            btn.textContent = num;
            btn.dataset.count = num;
            if (num === 2) btn.classList.add('active');
            btn.addEventListener('click', () => {
                document.querySelectorAll('.player-count-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedPlayerCount = num;
            });
            dom.setup.playerCountSelector.appendChild(btn);
        });
        [3, 4, 5, 6].forEach(num => {
            const btn = document.createElement('button');
            btn.className = 'digit-count-btn';
            btn.textContent = num;
            btn.dataset.count = num;
            if (num === 4) btn.classList.add('active');
            btn.addEventListener('click', () => {
                document.querySelectorAll('.digit-count-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedDigitCount = num;
            });
            dom.setup.digitCountSelector.appendChild(btn);
        });

        dom.buttons.showSetup.addEventListener('click', () => showScreen(dom.screens.setup));
        dom.buttons.startGame.addEventListener('click', () => {
            initializeState(selectedPlayerCount, selectedDigitCount);
            showScreen(dom.screens.game);
            startNewRound();
        });
        dom.buttons.restartGame.addEventListener('click', () => {
            myLastThreeGuesses = [];
            updatePopupPreview();
            dom.popup.icon.style.display = 'block';
            showScreen(dom.screens.welcome);
        });
        dom.game.mySecretNumberArea.addEventListener('click', () => {
            isSecretNumberVisible = !isSecretNumberVisible;
            updateSecretNumberDisplay();
        });
        dom.screens.gameOver.addEventListener('click', advanceGameOver);
        dom.buttons.popupHistory.addEventListener('click', () => {
            dom.popup.filterButtons.innerHTML = '';
            const myHistory = state.histories[MY_PLAYER_ID];
            const targetIds = Object.keys(myHistory).map(id => parseInt(id));
            if (targetIds.length > 0) {
                targetIds.forEach(id => {
                    const player = state.players.find(p => p.id === id);
                    const btn = document.createElement('button');
                    btn.className = 'filter-btn';
                    btn.textContent = player.name;
                    btn.dataset.filter = id;
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        renderHistory(id);
                    });
                    dom.popup.filterButtons.appendChild(btn);
                });
                dom.popup.filterButtons.querySelector('.filter-btn')?.classList.add('active');
                renderHistory(targetIds[0]);
            } else {
                renderHistory();
            }
            dom.popup.overlay.classList.add('visible');
        });
        dom.popup.overlay.addEventListener('click', (e) => {
            if (e.target === dom.popup.overlay) dom.popup.overlay.classList.remove('visible');
        });
        dom.game.keypad.addEventListener('click', (e) => {
            if (!e.target.classList.contains('key')) return;
            if (e.target.classList.contains('num')) {
                if (state.currentGuess.length < state.digitCount) {
                    state.currentGuess += e.target.textContent;
                    dom.game.guessDisplay.textContent = state.currentGuess.padEnd(state.digitCount, '-');
                }
            } else if (e.target.id === 'clear-btn') {
                state.currentGuess = state.currentGuess.slice(0, -1);
                dom.game.guessDisplay.textContent = state.currentGuess.padEnd(state.digitCount, '-');
            } else if (e.target.id === 'submit-guess-btn') {
                if (state.currentGuess.length === state.digitCount) handleGuess();
            }
        });
        dom.buttons.eliminate.addEventListener('click', handleEliminationAttempt);
        showScreen(dom.screens.welcome);
    }

    initializeApp();
});
