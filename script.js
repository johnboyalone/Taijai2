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

// --- GAME CONFIG & STATE ---
const INITIAL_ELIMINATION_TRIES = 3;
let myPlayerId = null;
let myPlayerName = '';
let currentGameId = null;
let isHost = false;
let isSecretNumberVisible = true;
let currentLocalGuess = "";

// --- DOM ELEMENTS ---
const dom = {
    screens: { lobby: document.getElementById('lobby-screen'), waitingRoom: document.getElementById('waiting-room-screen'), game: document.getElementById('game-screen'), gameOver: document.getElementById('game-over-screen'), },
    lobby: { playerNameInput: document.getElementById('player-name-input'), createRoomBtn: document.getElementById('create-room-btn'), joinRoomInput: document.getElementById('join-room-input'), joinRoomBtn: document.getElementById('join-room-btn'), errorMsg: document.getElementById('lobby-error-msg'), },
    waitingRoom: { roomCodeText: document.getElementById('room-code-text'), copyRoomCodeBtn: document.getElementById('copy-room-code-btn'), playerList: document.getElementById('player-list-waiting'), statusText: document.getElementById('waiting-status-text'), startGameBtn: document.getElementById('start-game-from-waiting-btn'), },
    game: document.getElementById('game-screen'),
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
}

function handleGuess() {
    if (!currentGameId || currentLocalGuess.length !== 4) return;
    const actionRef = database.ref(`games/${currentGameId}/actions`).push();
    actionRef.set({ type: 'GUESS', guesserId: myPlayerId, guess: currentLocalGuess, timestamp: firebase.database.ServerValue.TIMESTAMP });
    currentLocalGuess = "";
    document.getElementById('guess-display').textContent = '----';
}

function updateGameScreenUI(state) {
    const { players, roundTargetIndex, currentGuesserId, lastResult } = state;
    const activePlayerIds = Object.keys(players).filter(pId => !players[pId].isEliminated);
    const targetId = activePlayerIds[roundTargetIndex];
    const myPlayer = players[myPlayerId];
    const guesser = players[currentGuesserId];
    const target = players[targetId];

    dom.game.innerHTML = `
        <div id="status-header">
            <div id="main-status-text">${guesser.name} กำลังทาย</div>
            <div id="sub-status-text">เป้าหมาย: ${target.name}</div>
        </div>
        <div id="players-bar">
            ${Object.keys(players).map(pId => {
                const p = players[pId];
                const isGuesser = pId === currentGuesserId;
                const isTarget = pId === targetId;
                const isEliminated = p.isEliminated;
                let playerClass = 'player-status-box';
                if (isGuesser) playerClass += ' guesser';
                if (isTarget) playerClass += ' target';
                if (isEliminated) playerClass += ' eliminated';
                if (!isGuesser && !isTarget && !isEliminated) playerClass += ' inactive';
                return `<div class="${playerClass}" data-player-id="${pId}"><div class="player-name">${p.name}</div><div class="player-role">${isEliminated ? 'แพ้แล้ว 💀' : (isTarget ? 'เป้าหมาย' : `พลังชีวิต: ${p.eliminationTries} ❤️`)}</div></div>`;
            }).join('')}
        </div>
        <div id="my-secret-number-area">
            <div class="secret-label">เลขลับของคุณ (แตะเพื่อซ่อน/แสดง)</div>
            <div id="my-secret-number-display">${isSecretNumberVisible ? myPlayer.secretNumber : '****'}</div>
        </div>
        <div id="timer-container"><div id="timer-bar"></div></div>
        <div id="display-area"><div id="guess-display">${lastResult ? `${lastResult.strikes}S ${lastResult.balls}B` : '----'}</div></div>
        <div id="action-area">
            <div id="keypad">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'ลบ', 0, 'ทาย'].map(key => {
                    if (typeof key === 'number') return `<button class="key num">${key}</button>`;
                    if (key === 'ลบ') return `<button class="key action" id="clear-btn">ลบ</button>`;
                    if (key === 'ทาย') return `<button class="key action" id="submit-guess-btn">ทาย</button>`;
                }).join('')}
            </div>
            <button class="key eliminate" id="eliminate-btn">ตุยซะเถอะ!</button>
        </div>
    `;

    document.getElementById('my-secret-number-area').addEventListener('click', () => {
        isSecretNumberVisible = !isSecretNumberVisible;
        document.getElementById('my-secret-number-display').textContent = isSecretNumberVisible ? myPlayer.secretNumber : '****';
    });

    const isMyTurn = myPlayerId === currentGuesserId;
    const keypad = document.getElementById('keypad');
    if (isMyTurn) {
        keypad.querySelectorAll('.num').forEach(btn => {
            btn.addEventListener('click', () => {
                if (currentLocalGuess.length < 4) {
                    currentLocalGuess += btn.textContent;
                    document.getElementById('guess-display').textContent = currentLocalGuess.padEnd(4, '-');
                }
            });
        });
        document.getElementById('clear-btn').addEventListener('click', () => {
            currentLocalGuess = currentLocalGuess.slice(0, -1);
            document.getElementById('guess-display').textContent = currentLocalGuess.padEnd(4, '-');
        });
        document.getElementById('submit-guess-btn').addEventListener('click', handleGuess);
    }

    keypad.style.pointerEvents = isMyTurn ? 'auto' : 'none';
    keypad.style.opacity = isMyTurn ? '1' : '0.5';
    document.getElementById('eliminate-btn').disabled = !isMyTurn;
}

// --- FIREBASE FUNCTIONS ---
function createRoom() {
    myPlayerName = dom.lobby.playerNameInput.value.trim();
    if (!myPlayerName) { dom.lobby.errorMsg.textContent = 'กรุณาใส่ชื่อของคุณ'; return; }
    isHost = true;
    const gameRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    currentGameId = gameRoomId;
    const newPlayerRef = database.ref('games/' + gameRoomId + '/players').push();
    myPlayerId = newPlayerRef.key;
    const gameRef = database.ref('games/' + gameRoomId);
    const initialGameState = { gameState: 'waiting', hostId: myPlayerId, players: { [myPlayerId]: { name: myPlayerName } }, };
    gameRef.set(initialGameState).then(() => {
        listenToGameChanges();
        listenToActions(); // ★★★ Host เริ่มดักฟัง Action ★★★
    });
}

function joinRoom() {
    myPlayerName = dom.lobby.playerNameInput.value.trim();
    if (!myPlayerName) { dom.lobby.errorMsg.textContent = 'กรุณาใส่ชื่อของคุณ'; return; }
    const roomId = dom.lobby.joinRoomInput.value.trim().toUpperCase();
    if (!roomId) { dom.lobby.errorMsg.textContent = 'กรุณาใส่รหัสห้อง'; return; }
    const gameRef = database.ref('games/' + roomId);
    gameRef.once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const gameState = snapshot.val();
            if (gameState.gameState !== 'waiting') { dom.lobby.errorMsg.textContent = 'ไม่สามารถเข้าร่วมได้ เกมเริ่มไปแล้ว'; return; }
            isHost = false;
            currentGameId = roomId;
            const newPlayerRef = database.ref(`games/${roomId}/players`).push();
            myPlayerId = newPlayerRef.key;
            newPlayerRef.set({ name: myPlayerName }).then(() => { listenToGameChanges(); });
        } else { dom.lobby.errorMsg.textContent = 'ไม่พบห้องเกมนี้'; }
    });
}

function listenToGameChanges() {
    if (!currentGameId) return;
    const gameRef = database.ref('games/' + currentGameId);
    gameRef.on('value', (snapshot) => {
        if (!snapshot.exists()) { alert("ห้องเกมถูกปิดแล้ว"); window.location.reload(); return; }
        const gameState = snapshot.val();
        updateUI(gameState);
    });
}

function startGame() {
    if (!isHost || !currentGameId) return;
    const gameRef = database.ref('games/' + currentGameId);
    gameRef.once('value').then((snapshot) => {
        const currentState = snapshot.val();
        const playerIds = Object.keys(currentState.players);
        const playersData = {};
        playerIds.forEach(pId => {
            playersData[pId] = { ...currentState.players[pId], secretNumber: generateSecretNumber(4), eliminationTries: INITIAL_ELIMINATION_TRIES, isEliminated: false, };
        });
        const firstPlayerId = playerIds[0];
        const secondPlayerId = playerIds.length > 1 ? playerIds[1] : null;
        const initialPlayState = {
            gameState: 'playing',
            players: playersData,
            roundTargetIndex: 0,
            guesserQueue: playerIds.filter(pId => pId !== firstPlayerId),
            currentGuesserId: secondPlayerId,
        };
        gameRef.update(initialPlayState);
    });
}

// ★★★ ฟังก์ชัน listenToActions() ที่แก้ไขแล้ว ★★★
function listenToActions() {
    // หยุดการทำงานทันทีถ้าไม่ใช่ Host หรือไม่มี ID ห้อง
    if (!isHost || !currentGameId) return;

    const actionsRef = database.ref(`games/${currentGameId}/actions`);

    // ใช้ .on('child_added') เพื่อดักฟัง Action ใหม่ๆ ที่เข้ามา
    // นี่คือวิธีที่ถูกต้องและเสถียรที่สุด
    actionsRef.on('child_added', (snapshot) => {
        // ตรวจสอบให้แน่ใจว่า snapshot มีข้อมูลอยู่จริง
        if (!snapshot.exists()) {
            return;
        }

        const action = snapshot.val();
        const actionId = snapshot.key;

        // ตรวจสอบว่า action มี type หรือไม่ เพื่อป้องกัน error
        if (action && action.type === 'GUESS') {
            // เรียกใช้ฟังก์ชันประมวลผลการทาย
            processGuess(action);
        }

        // ★★★ ส่วนสำคัญ ★★★
        // หลังจากประมวลผลเสร็จแล้ว ให้ลบ action นั้นออกจากคิวทันที
        // เพื่อป้องกันการประมวลผลซ้ำซ้อน
        snapshot.ref.remove();
    });
}


// ★★★ ฟังก์ชัน processGuess() ที่แก้ไขใหม่ทั้งหมด ★★★
function processGuess(action) {
    const gameRef = database.ref('games/' + currentGameId);
    
    // ใช้ transaction เพื่อป้องกันปัญหาข้อมูลไม่ตรงกัน
    gameRef.transaction((currentState) => {
        // ถ้าไม่มี state ปัจจุบัน ให้ยกเลิก
        if (currentState === null) {
            return currentState;
        }
    
        // --- 1. คำนวณผลลัพธ์ ---
        const activePlayerIds = Object.keys(currentState.players).filter(pId => !currentState.players[pId].isEliminated);
        const targetId = activePlayerIds[currentState.roundTargetIndex];
        const targetPlayer = currentState.players[targetId];
        const result = checkGuess(action.guess, targetPlayer.secretNumber);
    
        // --- 2. เตรียม State ใหม่ ---
        let newState = { ...currentState };
        newState.lastResult = { guess: action.guess, ...result }; // เก็บผลลัพธ์ล่าสุดเพื่อแสดงผล
    
        // --- 3. เปลี่ยนตาคนทาย ---
        // ถ้ายังมีคนในคิวรอทายอยู่
        if (newState.guesserQueue && newState.guesserQueue.length > 0) {
            // เอาคนถัดไปในคิวมาเป็นคนทาย
            newState.currentGuesserId = newState.guesserQueue.shift();
        } else {
            // ถ้าคิวหมดแล้ว (ทุกคนทายครบแล้ว) -> เริ่มรอบใหม่
            const newTargetIndex = (newState.roundTargetIndex + 1) % activePlayerIds.length;
            const newTargetId = activePlayerIds[newTargetIndex];
                
            // สร้างคิวใหม่สำหรับรอบใหม่ (ทุกคนที่ไม่ใช่เป้าหมายใหม่)
            const newGuesserQueue = activePlayerIds.filter(pId => pId !== newTargetId);
                
            newState.roundTargetIndex = newTargetIndex;
            newState.guesserQueue = newGuesserQueue;
                
            // เอาคนแรกในคิวใหม่มาเป็นคนทาย
            newState.currentGuesserId = newState.guesserQueue.shift();
                
            // ★★★ แก้ไขปัญหาสำคัญ: ล้างผลลัพธ์เก่าเมื่อขึ้นรอบใหม่ ★★★
            newState.lastResult = null; 
        }
    
        // ส่งคืน State ที่อัปเดตแล้ว
        return newState;
    });
}


function updateUI(state) {
    if (!state) return;
    if (state.gameState === 'waiting') {
        showScreen(dom.screens.waitingRoom);
        updateWaitingRoomUI(state);
    } else if (state.gameState === 'playing') {
        showScreen(dom.screens.game);
        updateGameScreenUI(state);
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
        const canStart = Object.keys(state.players || {}).length >= 2;
        dom.waitingRoom.startGameBtn.disabled = !canStart;
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
        if (currentGameId) { navigator.clipboard.writeText(currentGameId).then(() => alert('คัดลอกรหัสห้องแล้ว!')); }
    });
    dom.waitingRoom.startGameBtn.addEventListener('click', startGame);
    showScreen(dom.screens.lobby);
}

// --- START THE APP ---
initializeApp();