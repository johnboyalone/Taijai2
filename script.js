// ★★★ FIREBASE SDK v9 SETUP ★★★
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, set, onValue, get, child, push } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyANK5rvwlgWc11EvXQRXpsSOO-tGV29pKA",
  authDomain: "taijai2.firebaseapp.com",
  databaseURL: "https://taijai2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "taijai2",
  storageBucket: "taijai2.appspot.com",
  messagingSenderId: "111291976868",
  appId: "1:111291976868:web:fee4606918ba2bbf93ea31"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// --- GAME CONFIG & STATE ---
const TIME_LIMIT = 20;
const INITIAL_ELIMINATION_TRIES = 3;

// --- MULTIPLAYER STATE ---
let myPlayerId = null;
let myPlayerName = '';
let currentGameId = null;
let isHost = false;

// --- LOCAL STATE (ข้อมูลที่ไม่ต้องซิงค์) ---
let localState = {
    timerInterval: null,
    isSecretNumberVisible: true,
};

// --- DOM ELEMENTS ---
const dom = {
    screens: {
        lobby: document.getElementById('lobby-screen'),
        waitingRoom: document.getElementById('waiting-room-screen'),
        game: document.getElementById('game-screen'),
        gameOver: document.getElementById('game-over-screen'),
    },
    lobby: {
        playerNameInput: document.getElementById('player-name-input'),
        createRoomBtn: document.getElementById('create-room-btn'),
        joinRoomInput: document.getElementById('join-room-input'),
        joinRoomBtn: document.getElementById('join-room-btn'),
        errorMsg: document.getElementById('lobby-error-msg'),
    },
    waitingRoom: {
        roomCodeText: document.getElementById('room-code-text'),
        copyRoomCodeBtn: document.getElementById('copy-room-code-btn'),
        playerList: document.getElementById('player-list-waiting'),
        statusText: document.getElementById('waiting-status-text'),
        startGameBtn: document.getElementById('start-game-from-waiting-btn'),
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
        skullAnimationContainer: document.getElementById('skull-animation-container'),
    },
    buttons: {
        eliminate: document.getElementById('eliminate-btn'),
        popupHistory: document.getElementById('popup-history-btn'),
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
// --- FIREBASE COMMUNICATION & UI UPDATE FUNCTIONS ---

async function createRoom() {
    myPlayerName = dom.lobby.playerNameInput.value.trim();
    if (!myPlayerName) {
        dom.lobby.errorMsg.textContent = 'กรุณาใส่ชื่อของคุณ';
        return;
    }

    isHost = true;
    // สร้าง ID ผู้เล่นที่ไม่ซ้ำกัน (ใช้ push ไปที่ path ที่ไม่มีอยู่จริงเพื่อเอา key)
    const newPlayerRef = push(ref(database, 'players'));
    myPlayerId = newPlayerRef.key;

    const gameRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    currentGameId = gameRoomId;
    const gameRef = ref(database, 'games/' + gameRoomId);

    const initialGameState = {
        gameState: 'waiting',
        hostId: myPlayerId,
        players: {
            [myPlayerId]: { name: myPlayerName, isReady: true }
        },
        gameConfig: {
            digitCount: 4, // ค่าเริ่มต้น
            initialTries: INITIAL_ELIMINATION_TRIES
        },
        // เพิ่ม path สำหรับ action และผลลัพธ์
        lastAction: null,
        lastResult: null,
    };

    await set(gameRef, initialGameState);
    listenToGameChanges();
}

async function joinRoom() {
    myPlayerName = dom.lobby.playerNameInput.value.trim();
    if (!myPlayerName) {
        dom.lobby.errorMsg.textContent = 'กรุณาใส่ชื่อของคุณ';
        return;
    }

    const roomId = dom.lobby.joinRoomInput.value.trim().toUpperCase();
    if (!roomId) {
        dom.lobby.errorMsg.textContent = 'กรุณาใส่รหัสห้อง';
        return;
    }

    const gameRef = ref(database, 'games/' + roomId);
    const snapshot = await get(gameRef);

    if (snapshot.exists()) {
        const gameState = snapshot.val();
        if (gameState.gameState !== 'waiting') {
            dom.lobby.errorMsg.textContent = 'ไม่สามารถเข้าร่วมได้ เกมเริ่มไปแล้ว';
            return;
        }

        isHost = false;
        currentGameId = roomId;
        const newPlayerRef = push(ref(database, `games/${roomId}/players`));
        myPlayerId = newPlayerRef.key;

        const playerRef = child(gameRef, 'players/' + myPlayerId);
        await set(playerRef, { name: myPlayerName, isReady: true });

        listenToGameChanges();
    } else {
        dom.lobby.errorMsg.textContent = 'ไม่พบห้องเกมนี้';
    }
}

function listenToGameChanges() {
    if (!currentGameId) return;
    const gameRef = ref(database, 'games/' + currentGameId);

    onValue(gameRef, (snapshot) => {
        if (!snapshot.exists()) {
            alert("ห้องเกมถูกปิดแล้ว");
            window.location.reload();
            return;
        }
        const gameState = snapshot.val();
        updateUI(gameState); // ส่ง state ทั้งหมดไปวาด UI
    });
}

// --- MAIN UI UPDATE FUNCTION ---
function updateUI(state) {
    if (!state) return;

    // Logic to show the correct screen based on gameState
    if (state.gameState === 'waiting') {
        showScreen(dom.screens.waitingRoom);
        updateWaitingRoomUI(state);
    } else if (state.gameState === 'playing') {
        showScreen(dom.screens.game);
        updateGameScreenUI(state);
    } else if (state.gameState === 'finished') {
        showScreen(dom.screens.gameOver);
        // updateGameOverUI(state); // จะทำในอนาคต
    } else {
        showScreen(dom.screens.lobby);
    }
}

function updateWaitingRoomUI(state) {
    dom.waitingRoom.roomCodeText.textContent = currentGameId;
    dom.waitingRoom.playerList.innerHTML = ''; // Clear list before repopulating

    Object.values(state.players || {}).forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name + (player.isReady ? ' (พร้อมแล้ว)' : '');
        dom.waitingRoom.playerList.appendChild(li);
    });

    if (isHost) {
        dom.waitingRoom.statusText.textContent = 'คุณคือเจ้าของห้อง กด "เริ่มเกม" เมื่อทุกคนพร้อม';
        dom.waitingRoom.startGameBtn.classList.remove('hidden');
        // สามารถเพิ่มเงื่อนไขให้กดได้เมื่อมีผู้เล่นมากกว่า 1 คน
        dom.waitingRoom.startGameBtn.disabled = Object.keys(state.players).length < 2;
    } else {
        dom.waitingRoom.statusText.textContent = 'รอเจ้าของห้องเริ่มเกม...';
        dom.waitingRoom.startGameBtn.classList.add('hidden');
    }
}

function updateGameScreenUI(state) {
    const { players, roundTargetId, currentGuesserId, gameConfig, currentGuess } = state;
    const myPlayerData = players[myPlayerId];
    const target = players[roundTargetId];
    const guesser = players[currentGuesserId];

    if (!myPlayerData || !target || !guesser) return; // รอข้อมูลครบ

    // Update status texts
    dom.game.mainStatusText.textContent = currentGuesserId === myPlayerId ? "ตาของฉัน" : `${guesser.name} กำลังทาย`;
    dom.game.subStatusText.textContent = `เป้าหมาย: ${target.name}`;

    // Update my secret number
    dom.game.mySecretNumberDisplay.textContent = localState.isSecretNumberVisible ? myPlayerData.secretNumber : "*".repeat(gameConfig.digitCount);

    // Update guess display
    dom.game.guessDisplay.textContent = (currentGuess || "").padEnd(gameConfig.digitCount, '-');

    // Update players bar
    dom.game.playersBar.innerHTML = ''; // Clear bar
    dom.game.playersBar.appendChild(dom.game.energyBeamSvg); // Add beam SVG back

    Object.entries(players).forEach(([id, p]) => {
        const playerBox = document.createElement('div');
        playerBox.className = 'player-status-box';
        playerBox.dataset.playerId = id;

        if (p.isEliminated) {
            playerBox.classList.add('eliminated');
            playerBox.innerHTML = `<div class="player-name">${p.name}</div><div class="player-role">แพ้แล้ว 💀</div>`;
        } else {
            if (id === currentGuesserId) playerBox.classList.add('guesser');
            if (id === roundTargetId) playerBox.classList.add('target');
            if (id !== currentGuesserId && id !== roundTargetId) playerBox.classList.add('inactive');
            playerBox.innerHTML = `<div class="player-name">${p.name}</div><div class="player-role">พลังชีวิต: ${p.eliminationTries} ❤️</div>`;
        }
        dom.game.playersBar.appendChild(playerBox);
    });
    
    dom.game.playersBar.appendChild(dom.game.shoutGuessDisplay); // Add shoutbox back

    // Redraw energy beam
    setTimeout(() => {
        const guesserElement = document.querySelector(`.player-status-box[data-player-id='${guesser.id}']`);
        const targetElement = document.querySelector(`.player-status-box[data-player-id='${target.id}']`);
        drawEnergyBeam(guesserElement, targetElement);
    }, 50);

    // Enable/disable keypad for current player
    const isMyTurn = currentGuesserId === myPlayerId;
    dom.game.keypad.style.pointerEvents = isMyTurn ? 'auto' : 'none';
    dom.game.keypad.style.opacity = isMyTurn ? '1' : '0.5';
    dom.buttons.eliminate.disabled = !isMyTurn;
}
// --- UI ANIMATION FUNCTIONS ---

function drawEnergyBeam(guesserElement, targetElement) {
    const beamSvg = dom.game.energyBeamSvg;
    const beamPath = dom.game.energyBeamPath;

    if (!guesserElement || !targetElement) {
        beamSvg.classList.add('hidden');
        return;
    }

    const barRect = dom.game.playersBar.getBoundingClientRect();
    const guesserRect = guesserElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    const startX = guesserRect.left - barRect.left + guesserRect.width / 2;
    const startY = guesserRect.top - barRect.top + guesserRect.height;
    const endX = targetRect.left - barRect.left + targetRect.width / 2;
    const endY = targetRect.top - barRect.top + targetRect.height;

    beamPath.setAttribute('d', `M ${startX},${startY} L ${endX},${endY}`);
    beamSvg.classList.remove('hidden');
}

function triggerSkullAnimation(playerId) {
    const playerBox = document.querySelector(`.player-status-box[data-player-id='${playerId}']`);
    if (!playerBox) return;

    const skull = dom.game.skullAnimationContainer;
    const playerRect = playerBox.getBoundingClientRect();
    const containerRect = document.body.getBoundingClientRect();

    // Set target position for the animation
    const targetX = playerRect.left + playerRect.width / 2;
    const targetY = playerRect.top + playerRect.height / 2;
    document.documentElement.style.setProperty('--skull-target-x', `${targetX}px`);
    document.documentElement.style.setProperty('--skull-target-y', `${targetY}px`);

    skull.classList.remove('hidden');
    skull.classList.add('animate');

    setTimeout(() => {
        skull.classList.remove('animate');
        skull.classList.add('hidden');
    }, 1500); // Animation duration
}


// --- PLAYER ACTION FUNCTIONS (CLIENT-SIDE) ---

async function sendGuess(isElimination) {
    const guessInput = dom.game.guessDisplay.textContent.replace(/-/g, '');
    const gameRef = ref(database, `games/${currentGameId}`);
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) return;
    const state = snapshot.val();

    if (guessInput.length !== state.gameConfig.digitCount) {
        alert("กรุณาใส่เลขให้ครบทุกหลัก");
        return;
    }

    const action = {
        type: isElimination ? 'ELIMINATE' : 'GUESS',
        playerId: myPlayerId,
        guess: guessInput,
        timestamp: Date.now()
    };

    // ส่ง action ขึ้นไปให้ Host ประมวลผล
    await set(child(gameRef, 'lastAction'), action);
}

async function sendKeystroke(key) {
    const gameRef = ref(database, `games/${currentGameId}`);
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) return;
    const state = snapshot.val();

    let newGuess = state.currentGuess || '';
    if (key === 'clear') {
        newGuess = newGuess.slice(0, -1);
    } else if (newGuess.length < state.gameConfig.digitCount) {
        newGuess += key;
    }

    // อัปเดตการกดปุ่มแบบ real-time
    await set(child(gameRef, 'currentGuess'), newGuess);
}


// --- GAME LOGIC FUNCTIONS (HOST-SIDE) ---

async function startGameFromWaitingBtnClick() {
    if (!isHost || !currentGameId) return;

    const gameRef = ref(database, 'games/'' + currentGameId);
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) return;

    const currentState = snapshot.val();
    const playerIds = Object.keys(currentState.players);

    const startingPlayersData = {};
    playerIds.forEach(id => {
        startingPlayersData[id] = {
            ...currentState.players[id],
            secretNumber: generateSecretNumber(currentState.gameConfig.digitCount),
            eliminationTries: currentState.gameConfig.initialTries,
            isEliminated: false,
            orderOfElimination: 0,
        };
    });

    const firstTargetIndex = Math.floor(Math.random() * playerIds.length);
    const firstTargetId = playerIds[firstTargetIndex];
    const guesserIds = playerIds.filter(id => id !== firstTargetId);
    const firstGuesserId = guesserIds[0];

    const updates = {
        gameState: 'playing',
        hostId: currentState.hostId,
        gameConfig: currentState.gameConfig,
        players: startingPlayersData,
        roundTargetId: firstTargetId,
        currentGuesserId: firstGuesserId,
        guesserQueue: guesserIds.slice(1),
        currentGuess: '',
        lastAction: null,
        lastResult: null,
    };

    await set(gameRef, updates);
}

// ฟังก์ชันนี้จะถูกเรียกใช้โดย Host เมื่อมี Action ใหม่เข้ามา
async function processPlayerAction(action, currentState) {
    if (!isHost || !action) return;

    const { type, playerId, guess } = action;
    let newState = { ...currentState }; // Copy state to modify

    // Logic for processing guess or elimination
    // (จะเพิ่มในขั้นตอนต่อไป)

    // อัปเดต state กลับขึ้นไปบน Firebase
    const gameRef = ref(database, 'games/' + currentGameId);
    await set(gameRef, newState);
}


// --- EVENT LISTENERS ---
function initializeApp() {
    // Lobby Screen
    dom.lobby.createRoomBtn.addEventListener('click', createRoom);
    dom.lobby.joinRoomBtn.addEventListener('click', joinRoom);

    // Waiting Room Screen
    dom.waitingRoom.startGameBtn.addEventListener('click', startGameFromWaitingBtnClick);
    dom.waitingRoom.copyRoomCodeBtn.addEventListener('click', () => {
        if (currentGameId) {
            navigator.clipboard.writeText(currentGameId).then(() => {
                alert('คัดลอกรหัสห้องแล้ว!');
            });
        }
    });

    // Game Screen
    dom.game.mySecretNumberArea.addEventListener('click', () => {
        localState.isSecretNumberVisible = !localState.isSecretNumberVisible;
        // Re-render with current state to update visibility
        const gameRef = ref(database, 'games/' + currentGameId);
        get(gameRef).then(snapshot => {
            if (snapshot.exists()) {
                updateGameScreenUI(snapshot.val());
            }
        });
    });

    dom.game.keypad.addEventListener('click', (e) => {
        if (!e.target.classList.contains('key')) return;
        if (e.target.classList.contains('num')) {
            sendKeystroke(e.target.textContent);
        } else if (e.target.id === 'clear-btn') {
            sendKeystroke('clear');
        } else if (e.target.id === 'submit-guess-btn') {
            sendGuess(false);
        }
    });

    dom.buttons.eliminate.addEventListener('click', () => sendGuess(true));

    // Start on the lobby screen
    showScreen(dom.screens.lobby);
}

// --- START THE APP ---
initializeApp();
