// ★★★★★ SCRIPT.JS - FINAL FIXED VERSION (v8-Fixed) ★★★★★

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyANK5rvwlgWc11EvXQRXpsSOO-tGV29pKA",
    authDomain: "taijai2.firebaseapp.com",
    databaseURL: "https://taijai2-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "taijai2",
    storageBucket: "taijai2.appspot.com",
    messagingSenderId: "111291976868",
    appId: "1:111291976868:web:fee4606918ba2bbf93ea31"
};

// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// --- DOM ELEMENTS ---
const dom = {
    screens: {
        lobby: document.getElementById('lobby-screen'),
        waitingRoom: document.getElementById('waiting-room-screen'),
        game: document.getElementById('game-screen'),
    },
    buttons: {
        createRoom: document.getElementById('create-room-btn'),
        joinRoom: document.getElementById('join-room-btn'),
        copyRoomCode: document.getElementById('copy-room-code-btn'),
        startGame: document.getElementById('start-game-btn'),
        submitGuess: document.getElementById('submit-guess-btn'),
        eliminate: document.getElementById('eliminate-btn'),
    },
    inputs: {
        playerName: document.getElementById('player-name-input'),
        roomCode: document.getElementById('room-code-input'),
    },
    lobby: { error: document.getElementById('lobby-error') },
    waitingRoom: {
        roomCodeDisplay: document.getElementById('room-code-display'),
        playerList: document.getElementById('player-list'),
    },
    game: {
        mainStatusText: document.getElementById('main-status-text'),
        subStatusText: document.getElementById('sub-status-text'),
        playersBar: document.getElementById('players-bar'),
        mySecretNumberDisplay: document.getElementById('my-secret-number-display'),
        guessDisplay: document.getElementById('guess-display'),
        keypad: document.getElementById('keypad'),
        energyBeam: document.getElementById('energy-beam'),
    },
};

// --- GAME STATE (Client-side) ---
let myPlayerId = null;
let currentGameId = null;
let currentGuess = "";
let gameState = {};

// --- HELPER FUNCTIONS ---
function generateSecretNumber(digitCount) {
    let digits = [];
    while (digits.length < digitCount) {
        const digit = Math.floor(Math.random() * 10);
        if (digits.indexOf(digit) === -1) { digits.push(digit); }
    }
    return digits.join('');
}

function checkGuess(guess, secret) {
    let strikes = 0, balls = 0;
    let guessChars = guess.split(''), secretChars = secret.split('');
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

function showScreen(screenElement) {
    Object.values(dom.screens).forEach(s => s.classList.add('hidden'));
    screenElement.classList.remove('hidden');
}

// --- UI UPDATE FUNCTIONS ---
function updateWaitingRoomUI(gameData) {
    dom.waitingRoom.roomCodeDisplay.textContent = currentGameId;
    dom.waitingRoom.playerList.innerHTML = '';
    Object.values(gameData.players).forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name + (player.id === gameData.hostId ? ' (👑 Host)' : '');
        dom.waitingRoom.playerList.appendChild(li);
    });
    dom.buttons.startGame.style.display = (myPlayerId === gameData.hostId) ? 'block' : 'none';
}

function updateGameUI(gameData) {
    const { players, roundTargetIndex, currentGuesserId, digitCount } = gameData;
    const activePlayerIds = Object.keys(players).filter(pId => !players[pId].isEliminated);
    if (activePlayerIds.length === 0) return;

    const targetId = activePlayerIds[roundTargetIndex];
    const target = players[targetId];
    const guesser = players[currentGuesserId];
    const myPlayer = players[myPlayerId];

    if (!target || !guesser || !myPlayer) return;

    dom.game.mainStatusText.textContent = guesser.id === myPlayerId ? "ตาของคุณ" : `${guesser.name} กำลังทาย`;
    dom.game.subStatusText.textContent = `เป้าหมาย: ${target.name}`;
    dom.game.mySecretNumberDisplay.textContent = myPlayer.secretNumber;

    dom.game.playersBar.innerHTML = '';
    Object.values(players).forEach(p => {
        const playerBox = document.createElement('div');
        playerBox.className = 'player-status-box';
        playerBox.dataset.playerId = p.id;
        if (p.isEliminated) playerBox.classList.add('eliminated');
        else {
            if (p.id === guesser.id) playerBox.classList.add('guesser');
            if (p.id === target.id) playerBox.classList.add('target');
        }
        playerBox.innerHTML = `
            <div class="player-name">${p.name}</div>
            <div class="player-role">${p.isEliminated ? 'แพ้แล้ว 💀' : (p.id === target.id ? 'เป้าหมาย' : `พลังชีวิต: ${p.eliminationTries} ❤️`)}</div>
        `;
        dom.game.playersBar.appendChild(playerBox);
    });

    setTimeout(() => {
        const guesserElement = document.querySelector(`.player-status-box[data-player-id='${guesser.id}']`);
        const targetElement = document.querySelector(`.player-status-box[data-player-id='${target.id}']`);
        drawEnergyBeam(guesserElement, targetElement);
    }, 50);

    const isMyTurn = currentGuesserId === myPlayerId;
    dom.game.keypad.style.pointerEvents = isMyTurn ? 'auto' : 'none';
    dom.game.keypad.style.opacity = isMyTurn ? '1' : '0.5';
    dom.buttons.submitGuess.disabled = !isMyTurn;
}

function drawEnergyBeam(guesserElement, targetElement) {
    const beam = dom.game.energyBeam;
    if (!guesserElement || !targetElement) {
        beam.style.display = 'none';
        return;
    }
    const barRect = dom.game.playersBar.getBoundingClientRect();
    const guesserRect = guesserElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const startX = guesserRect.left - barRect.left + guesserRect.width / 2;
    const startY = guesserRect.top - barRect.top + guesserRect.height / 2;
    const endX = targetRect.left - barRect.left + targetRect.width / 2;
    const endY = targetRect.top - barRect.top + targetRect.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    beam.style.width = `${distance}px`;
    beam.style.left = `${startX}px`;
    beam.style.top = `${startY}px`;
    beam.style.transform = `rotate(${angle}deg)`;
    beam.style.display = 'block';
}

// --- Firebase Interaction ---
function listenToGameUpdates(gameId) {
    const gameRef = database.ref('games/' + gameId);
    const gameListener = gameRef.on('value', (snapshot) => {
        const gameData = snapshot.val();
        if (!gameData) {
            showScreen(dom.screens.lobby);
            alert("ห้องเกมถูกปิดแล้ว");
            cleanupListeners(gameId);
            return;
        }
        gameState = gameData;
        if (gameData.gameState === 'waiting') {
            showScreen(dom.screens.waitingRoom);
            updateWaitingRoomUI(gameData);
        } else if (gameData.gameState === 'playing') {
            showScreen(dom.screens.game);
            updateGameUI(gameData);
            if (gameData.lastResult && gameData.lastResult.guess) {
                const resultText = `${gameData.lastResult.strikes}S ${gameData.lastResult.balls}B`;
                dom.game.guessDisplay.textContent = resultText;
            } else {
                const digitCount = gameData.digitCount || 4;
                dom.game.guessDisplay.textContent = '-'.repeat(digitCount);
            }
        }
    });

    // ตั้ง listener สำหรับ actions (เฉพาะ host)
    const actionsRef = database.ref(`games/${gameId}/actions`);
    const actionsListener = actionsRef.on('child_added', (snapshot) => {
        const action = snapshot.val();
        if (action.type === 'GUESS' && myPlayerId === gameState.hostId) {
            processGuess(action);
            snapshot.ref.remove(); // ลบ action หลังประมวลผล
        }
    });

    // เก็บ listener เพื่อลบภายหลัง
    window.cleanupListeners = function (id) {
        if (id === gameId) {
            gameRef.off('value', gameListener);
            actionsRef.off('child_added', actionsListener);
        }
    };
}

function processGuess(action) {
    const gameRef = database.ref('games/' + currentGameId);
    gameRef.transaction((currentState) => {
        if (currentState === null || !currentState.players[action.playerId]) return currentState;

        const activePlayerIds = Object.keys(currentState.players).filter(pId => !currentState.players[pId].isEliminated);
        const targetId = activePlayerIds[currentState.roundTargetIndex];
        const targetPlayer = currentState.players[targetId];
        if (!targetPlayer) return currentState;

        const result = checkGuess(action.guess, targetPlayer.secretNumber);
        let newState = { ...currentState };
        newState.lastResult = { guess: action.guess, ...result };

        // ลดพลังชีวิตถ้าทายผิด
        const guesser = newState.players[action.playerId];
        if (result.strikes !== newState.digitCount) {
            guesser.eliminationTries -= 1;
            if (guesser.eliminationTries <= 0) {
                guesser.isEliminated = true;
            }
        }

        // จัดการ turn ถัดไป
        let queue = newState.guesserQueue || [];
        if (queue.length > 0) {
            newState.currentGuesserId = queue.shift();
            newState.guesserQueue = queue;
        } else {
            const newTargetIndex = (newState.roundTargetIndex + 1) % activePlayerIds.length;
            const newTargetId = activePlayerIds[newTargetIndex];
            const newQueue = activePlayerIds.filter(pId => pId !== newTargetId);
            newState.roundTargetIndex = newTargetIndex;
            newState.currentGuesserId = newQueue.shift();
            newState.guesserQueue = newQueue;
            newState.lastResult = null;
        }

        return newState;
    });
}

// --- INITIALIZATION & EVENT LISTENERS ---
function initializeApp() {
    auth.signInAnonymously().then(() => {
        myPlayerId = auth.currentUser.uid;
    }).catch((error) => {
        console.error("Auth Error:", error);
        dom.lobby.error.textContent = "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์";
    });

    dom.buttons.createRoom.addEventListener('click', () => {
        const playerName = dom.inputs.playerName.value.trim();
        if (!playerName) {
            dom.lobby.error.textContent = "กรุณาใส่ชื่อผู้เล่น";
            return;
        }
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const gameRef = database.ref('games/' + roomId);
        const playerRef = gameRef.child('players').child(myPlayerId);
        const initialGameState = {
            hostId: myPlayerId,
            gameState: 'waiting',
            players: {},
            digitCount: 4,
        };
        gameRef.set(initialGameState).then(() => {
            playerRef.set({
                id: myPlayerId,
                name: playerName,
                isEliminated: false,
                eliminationTries: 3,
            }).then(() => {
                playerRef.onDisconnect().remove(); // ลบเมื่อ disconnect
                currentGameId = roomId;
                listenToGameUpdates(roomId);
            });
        });
    });

    dom.buttons.joinRoom.addEventListener('click', () => {
        const playerName = dom.inputs.playerName.value.trim();
        const roomId = dom.inputs.roomCode.value.trim().toUpperCase();
        if (!playerName || !roomId) {
            dom.lobby.error.textContent = "กรุณาใส่ชื่อและรหัสห้อง";
            return;
        }
        const playerRef = database.ref(`games/${roomId}/players/${myPlayerId}`);
        const gameRef = database.ref('games/' + roomId);
        gameRef.once('value', (snapshot) => {
            if (snapshot.exists()) {
                playerRef.set({
                    id: myPlayerId,
                    name: playerName,
                    isEliminated: false,
                    eliminationTries: 3,
                }).then(() => {
                    playerRef.onDisconnect().remove();
                    currentGameId = roomId;
                    listenToGameUpdates(roomId);
                });
            } else {
                dom.lobby.error.textContent = "ไม่พบห้องเกมนี้";
            }
        });
    });

    dom.buttons.startGame.addEventListener('click', () => {
        if (gameState.hostId !== myPlayerId) return;
        const gameRef = database.ref('games/' + currentGameId);
        const playerIds = Object.keys(gameState.players);
        const updatedPlayers = {};
        playerIds.forEach(pId => {
            updatedPlayers[pId] = {
                ...gameState.players[pId],
                secretNumber: generateSecretNumber(gameState.digitCount),
            };
        });
        const targetIndex = 0;
        const targetId = playerIds[targetIndex];
        const guesserQueue = playerIds.filter(pId => pId !== targetId);
        const firstGuesserId = guesserQueue.shift();

        gameRef.update({
            gameState: 'playing',
            players: updatedPlayers,
            roundTargetIndex: targetIndex,
            guesserQueue: guesserQueue,
            currentGuesserId: firstGuesserId,
            lastResult: null,
        });
    });

    dom.buttons.copyRoomCode.addEventListener('click', () => {
        navigator.clipboard.writeText(currentGameId).then(() => {
            alert('คัดลอกรหัสห้องแล้ว!');
        }).catch(err => {
            console.warn('Copy failed:', err);
        });
    });

    dom.game.keypad.addEventListener('click', (e) => {
        if (!e.target.classList.contains('key')) return;
        const digitCount = gameState.digitCount || 4;
        if (e.target.classList.contains('num')) {
            if (currentGuess.length < digitCount) {
                currentGuess += e.target.textContent;
            }
        } else if (e.target.id === 'clear-btn') {
            currentGuess = currentGuess.slice(0, -1);
        }
        dom.game.guessDisplay.textContent = currentGuess.padEnd(digitCount, '-');
    });

    dom.buttons.submitGuess.addEventListener('click', () => {
        const digitCount = gameState.digitCount || 4;
        if (currentGuess.length !== digitCount || !gameState.players[myPlayerId]) return;
        if (dom.buttons.submitGuess.disabled) return; // ป้องกัน double click

        if (myPlayerId === gameState.hostId) {
            processGuess({ type: 'GUESS', guess: currentGuess, playerId: myPlayerId });
        } else {
            const actionsRef = database.ref(`games/${currentGameId}/actions`);
            actionsRef.push({ type: 'GUESS', guess: currentGuess, playerId: myPlayerId });
        }
        currentGuess = "";
        dom.game.guessDisplay.textContent = '-'.repeat(digitCount);
        dom.buttons.submitGuess.disabled = true;
    });

    // เริ่มต้น
    showScreen(dom.screens.lobby);
}

// --- Start the App ---
initializeApp();