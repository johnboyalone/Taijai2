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

// --- DOM ELEMENTS (No changes needed here) ---
const dom = {
    screens: { lobby: document.getElementById('lobby-screen'), waitingRoom: document.getElementById('waiting-room-screen'), game: document.getElementById('game-screen'), gameOver: document.getElementById('game-over-screen'), },
    lobby: { playerNameInput: document.getElementById('player-name-input'), createRoomBtn: document.getElementById('create-room-btn'), joinRoomInput: document.getElementById('join-room-input'), joinRoomBtn: document.getElementById('join-room-btn'), errorMsg: document.getElementById('lobby-error-msg'), },
    waitingRoom: { roomCodeText: document.getElementById('room-code-text'), copyRoomCodeBtn: document.getElementById('copy-room-code-btn'), playerList: document.getElementById('player-list-waiting'), statusText: document.getElementById('waiting-status-text'), startGameBtn: document.getElementById('start-game-from-waiting-btn'), },
    game: { mainStatusText: document.getElementById('main-status-text'), subStatusText: document.getElementById('sub-status-text'), playersBar: document.getElementById('players-bar'), mySecretNumberArea: document.getElementById('my-secret-number-area'), mySecretNumberDisplay: document.getElementById('my-secret-number-display'), timerBar: document.getElementById('timer-bar'), guessDisplay: document.getElementById('guess-display'), keypad: document.getElementById('keypad'), shoutGuessDisplay: document.getElementById('shout-guess-display'), energyBeamSvg: document.getElementById('energy-beam-svg'), energyBeamPath: document.getElementById('energy-beam-path'), skullAnimationContainer: document.getElementById('skull-animation-container'), },
    buttons: { eliminate: document.getElementById('eliminate-btn'), popupHistory: document.getElementById('popup-history-btn'), },
    popup: { overlay: document.getElementById('history-popup-overlay'), popup: document.getElementById('history-popup'), filterButtons: document.getElementById('history-filter-buttons'), list: document.getElementById('history-popup-list'), previewText: document.querySelector('#popup-history-btn .preview-text'), icon: document.querySelector('#popup-history-btn .icon'), }
};


// --- HELPER FUNCTIONS ---
function generateSecretNumber(digitCount) {
    let digits = [];
    while (digits.length < digitCount) {
        const digit = Math.floor(Math.random() * 10);
        if (digits.indexOf(digit) === -1) { digits.push(digit); }
    }
    return digits.join('');
}

// --- UI FUNCTIONS ---
function showScreen(screenElement) {
    Object.values(dom.screens).forEach(s => s.classList.add('hidden'));
    screenElement.classList.remove('hidden');
}

// --- FIREBASE COMMUNICATION & UI UPDATE FUNCTIONS ---
async function createRoom() {
    myPlayerName = dom.lobby.playerNameInput.value.trim();
    if (!myPlayerName) {
        dom.lobby.errorMsg.textContent = 'กรุณาใส่ชื่อของคุณ';
        return;
    }

    isHost = true;
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
        gameConfig: { digitCount: 4, initialTries: INITIAL_ELIMINATION_TRIES },
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
        updateUI(gameState);
    });
}

function updateUI(state) {
    if (!state) return;

    if (state.gameState === 'waiting') {
        showScreen(dom.screens.waitingRoom);
        updateWaitingRoomUI(state);
    } else if (state.gameState === 'playing') {
        showScreen(dom.screens.game);
        // updateGameScreenUI(state); // จะทำในขั้นตอนต่อไป
    } else if (state.gameState === 'finished') {
        showScreen(dom.screens.gameOver);
        // updateGameOverUI(state); // จะทำในอนาคต
    } else {
        showScreen(dom.screens.lobby);
    }
}

function updateWaitingRoomUI(state) {
    dom.waitingRoom.roomCodeText.textContent = currentGameId;
    dom.waitingRoom.playerList.innerHTML = '';

    Object.values(state.players || {}).forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name + (player.isReady ? ' (พร้อมแล้ว)' : '');
        dom.waitingRoom.playerList.appendChild(li);
    });

    if (isHost) {
        dom.waitingRoom.statusText.textContent = 'คุณคือเจ้าของห้อง กด "เริ่มเกม" เมื่อทุกคนพร้อม';
        dom.waitingRoom.startGameBtn.classList.remove('hidden');
        dom.waitingRoom.startGameBtn.disabled = Object.keys(state.players).length < 2;
    } else {
        dom.waitingRoom.statusText.textContent = 'รอเจ้าของห้องเริ่มเกม...';
        dom.waitingRoom.startGameBtn.classList.add('hidden');
    }
}

// --- GAME LOGIC FUNCTIONS ---
async function startGameFromWaitingBtnClick() {
    if (!isHost || !currentGameId) return;

    const gameRef = ref(database, 'games/' + currentGameId);
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
        };
    });

    const firstTargetIndex = Math.floor(Math.random() * playerIds.length);
    const firstTargetId = playerIds[firstTargetIndex];
    const guesserIds = playerIds.filter(id => id !== firstTargetId);
    const firstGuesserId = guesserIds[0];

    const updates = {
        ...currentState,
        gameState: 'playing',
        players: startingPlayersData,
        roundTargetId: firstTargetId,
        currentGuesserId: firstGuesserId,
        guesserQueue: guesserIds.slice(1),
        currentGuess: ''
    };

    await set(gameRef, updates);
}

// --- EVENT LISTENERS ---
function initializeApp() {
    dom.lobby.createRoomBtn.addEventListener('click', createRoom);
    dom.lobby.joinRoomBtn.addEventListener('click', joinRoom);
    dom.waitingRoom.startGameBtn.addEventListener('click', startGameFromWaitingBtnClick);
    dom.waitingRoom.copyRoomCodeBtn.addEventListener('click', () => {
        if (currentGameId) {
            navigator.clipboard.writeText(currentGameId).then(() => {
                alert('คัดลอกรหัสห้องแล้ว!');
            });
        }
    });

    showScreen(dom.screens.lobby);
}

// --- START THE APP ---
initializeApp();
