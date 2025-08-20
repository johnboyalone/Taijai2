// ★★★ FIREBASE CONFIGURATION ★★★
const firebaseConfig = {
  apiKey: "AIzaSyANK5rvwlgWc11EvXQRXpsSOO-tGV29pKA",
  authDomain: "taijai2.firebaseapp.com",
  databaseURL: "https://taijai2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "taijai2",
  storageBucket: "taijai2.appspot.com",
  messagingSenderId: "111291976868",
  appId: "1:111291976868:web:fee4606918ba2bbf93ea31"
};

// ★★★ INITIALIZE FIREBASE (v8 Syntax) ★★★
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- GAME STATE ---
let myPlayerId = null;
let myPlayerName = '';
let currentGameId = null;
let isHost = false;

// --- DOM ELEMENTS ---
const dom = {
    screens: { lobby: document.getElementById('lobby-screen'), waitingRoom: document.getElementById('waiting-room-screen'), game: document.getElementById('game-screen'), gameOver: document.getElementById('game-over-screen'), },
    lobby: { playerNameInput: document.getElementById('player-name-input'), createRoomBtn: document.getElementById('create-room-btn'), joinRoomInput: document.getElementById('join-room-input'), joinRoomBtn: document.getElementById('join-room-btn'), errorMsg: document.getElementById('lobby-error-msg'), },
    waitingRoom: { roomCodeText: document.getElementById('room-code-text'), copyRoomCodeBtn: document.getElementById('copy-room-code-btn'), playerList: document.getElementById('player-list-waiting'), statusText: document.getElementById('waiting-status-text'), startGameBtn: document.getElementById('start-game-from-waiting-btn'), },
};

// --- UI FUNCTIONS ---
function showScreen(screenElement) {
    Object.values(dom.screens).forEach(s => s.classList.add('hidden'));
    screenElement.classList.remove('hidden');
}

// --- FIREBASE FUNCTIONS ---
function createRoom() {
    myPlayerName = dom.lobby.playerNameInput.value.trim();
    if (!myPlayerName) {
        dom.lobby.errorMsg.textContent = 'กรุณาใส่ชื่อของคุณ';
        return;
    }

    isHost = true;
    const gameRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    currentGameId = gameRoomId;
        
    const newPlayerRef = database.ref('games/' + gameRoomId + '/players').push();
    myPlayerId = newPlayerRef.key;

    const gameRef = database.ref('games/' + gameRoomId);
    const initialGameState = {
        gameState: 'waiting',
        hostId: myPlayerId,
        players: { [myPlayerId]: { name: myPlayerName } },
    };

    gameRef.set(initialGameState).then(() => {
        listenToGameChanges();
    });
}

function joinRoom() {
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

    const gameRef = database.ref('games/' + roomId);
    gameRef.once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const gameState = snapshot.val();
            if (gameState.gameState !== 'waiting') {
                dom.lobby.errorMsg.textContent = 'ไม่สามารถเข้าร่วมได้ เกมเริ่มไปแล้ว';
                return;
            }
            isHost = false;
            currentGameId = roomId;
            const newPlayerRef = database.ref(`games/${roomId}/players`).push();
            myPlayerId = newPlayerRef.key;
            newPlayerRef.set({ name: myPlayerName }).then(() => {
                listenToGameChanges();
            });
        } else {
            dom.lobby.errorMsg.textContent = 'ไม่พบห้องเกมนี้';
        }
    });
}

function listenToGameChanges() {
    if (!currentGameId) return;
    const gameRef = database.ref('games/' + currentGameId);
    gameRef.on('value', (snapshot) => {
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
    } else {
        showScreen(dom.screens.lobby);
    }
}

function updateWaitingRoomUI(state) {
    dom.waitingRoom.roomCodeText.textContent = currentGameId;
    dom.waitingRoom.playerList.innerHTML = '';
    Object.values(state.players || {}).forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
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

// --- EVENT LISTENERS ---
function initializeApp() {
    dom.lobby.createRoomBtn.addEventListener('click', createRoom);
    dom.lobby.joinRoomBtn.addEventListener('click', joinRoom);
    dom.waitingRoom.copyRoomCodeBtn.addEventListener('click', () => {
        if (currentGameId) {
            navigator.clipboard.writeText(currentGameId).then(() => alert('คัดลอกรหัสห้องแล้ว!'));
        }
    });
    showScreen(dom.screens.lobby);
}

// --- START THE APP ---
initializeApp();
