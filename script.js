// ★★★★★ SCRIPT.JS - FINAL ONLINE VERSION ★★★★★

// --- Firebase SDK Imports ---
// ใช้ SDK v8 (Legacy) เพื่อความเข้ากันได้กับโค้ดเดิมและลดความซับซ้อน
// ไม่ต้องใช้ import/export อีกต่อไป เพราะเราจะเรียกใช้ผ่านตัวแปร global `firebase`

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyANK5rvwlgWc11EvXQRXpsSOO-tGV29pKA",
    authDomain: "taijai2.firebaseapp.com",
    databaseURL: "https://taijai2-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "taijai2",
    storageBucket: "taijai2.appspot.com", // แก้ไข .firebaseapp.com เป็น .appspot.com
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
        setup: document.getElementById('setup-screen'),
        game: document.getElementById('game-screen'),
        gameOver: document.getElementById('game-over-screen'),
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
    lobby: {
        error: document.getElementById('lobby-error'),
    },
    waitingRoom: {
        roomCodeDisplay: document.getElementById('room-code-display'),
        playerList: document.getElementById('player-list'),
        waitingStatus: document.getElementById('waiting-status'),
    },
    setup: {
        playerCountSelector: document.getElementById('player-count-selector'),
        digitCountSelector: document.getElementById('digit-count-selector'),
    },
    game: {
        mainStatusText: document.getElementById('main-status-text'),
        subStatusText: document.getElementById('sub-status-text'),
        playersBar: document.getElementById('players-bar'),
        mySecretNumberDisplay: document.getElementById('my-secret-number-display'),
        timerBar: document.getElementById('timer-bar'),
        guessDisplay: document.getElementById('guess-display'),
        keypad: document.getElementById('keypad'),
        energyBeam: document.getElementById('energy-beam'),
        skullOverlay: document.getElementById('skull-overlay'),
    },
    // ... (สามารถเพิ่มส่วนอื่นๆ ของ dom ได้ตามต้องการ)
};

// --- GAME STATE (Client-side) ---
let myPlayerId = null;
let currentGameId = null;
let currentGuess = "";
let gameState = {}; // State ล่าสุดจาก Firebase จะถูกเก็บไว้ที่นี่

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

    // แสดง/ซ่อนปุ่มเริ่มเกมสำหรับ Host
    dom.buttons.startGame.style.display = (myPlayerId === gameData.hostId) ? 'block' : 'none';
}

function updateGameUI(gameData) {
    const { players, roundTargetIndex, currentGuesserId, digitCount } = gameData;
    const activePlayerIds = Object.keys(players).filter(pId => !players[pId].isEliminated);
    const targetId = activePlayerIds[roundTargetIndex];
    const target = players[targetId];
    const guesser = players[currentGuesserId];
    const myPlayer = players[myPlayerId];

    if (!target || !guesser || !myPlayer) return; // ป้องกัน Error

    // อัปเดตข้อความสถานะ
    dom.game.mainStatusText.textContent = guesser.id === myPlayerId ? "ตาของคุณ" : `${guesser.name} กำลังทาย`;
    dom.game.subStatusText.textContent = `เป้าหมาย: ${target.name}`;

    // อัปเดตเลขลับของฉัน
    dom.game.mySecretNumberDisplay.textContent = myPlayer.secretNumber;

    // อัปเดตแถบผู้เล่น
    dom.game.playersBar.innerHTML = '';
    Object.values(players).forEach(p => {
        const playerBox = document.createElement('div');
        playerBox.className = 'player-status-box';
        playerBox.dataset.playerId = p.id;
        if (p.isEliminated) {
            playerBox.classList.add('eliminated');
        } else {
            if (p.id === guesser.id) playerBox.classList.add('guesser');
            if (p.id === target.id) playerBox.classList.add('target');
        }
        playerBox.innerHTML = `<div class="player-name">${p.name}</div><div class="player-role">${p.isEliminated ? 'แพ้แล้ว 💀' : (p.id === target.id ? 'เป้าหมาย' : `พลังชีวิต: ${p.eliminationTries} ❤️`)}</div>`;
        dom.game.playersBar.appendChild(playerBox);
    });

    // วาดเส้นพลังงาน
    setTimeout(() => {
        const guesserElement = document.querySelector(`.player-status-box[data-player-id='${guesser.id}']`);
        const targetElement = document.querySelector(`.player-status-box[data-player-id='${target.id}']`);
        drawEnergyBeam(guesserElement, targetElement);
    }, 50);

    // เปิด/ปิดปุ่มกดตามตาของผู้เล่น
    const isMyTurn = currentGuesserId === myPlayerId;
    dom.game.keypad.style.pointerEvents = isMyTurn ? 'auto' : 'none';
    dom.game.keypad.style.opacity = isMyTurn ? '1' : '0.5';
    dom.buttons.eliminate.disabled = !isMyTurn;
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

// --- Firebase Interaction (Client-Side Logic) ---

function listenToGameUpdates(gameId) {
    const gameRef = database.ref('games/' + gameId);

    gameRef.on('value', (snapshot) => {
        const gameData = snapshot.val();
        if (!gameData) {
            showScreen(dom.screens.lobby);
            alert("ห้องเกมถูกปิดแล้ว");
            return;
        }

        gameState = gameData; // อัปเดต State ล่าสุด

        if (gameData.gameState === 'waiting') {
            showScreen(dom.screens.waitingRoom);
            updateWaitingRoomUI(gameData);
        } else if (gameData.gameState === 'playing') {
            showScreen(dom.screens.game);
            updateGameUI(gameData);

            // ตรวจสอบก่อนว่ามี lastResult หรือไม่
            if (gameData.lastResult && gameData.lastResult.guess) {
                const resultText = `${gameData.lastResult.strikes}S ${gameData.lastResult.balls}B`;
                dom.game.guessDisplay.textContent = resultText;
            } else {
                dom.game.guessDisplay.textContent = '-'.repeat(gameData.digitCount || 4);
            }
        }
        // สามารถเพิ่มเงื่อนไขสำหรับ gameState 'finished' ได้ในอนาคต
    });
}
// --- HOST-SIDE LOGIC (Only run by the host) ---

function processGuess(action) {
    const gameRef = database.ref('games/' + currentGameId);

    gameRef.transaction((currentState) => {
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
        newState.lastResult = { guess: action.guess, ...result };

        // --- 3. เปลี่ยนตาคนทาย ---
        let currentQueue = newState.guesserQueue || [];

        if (currentQueue.length > 0) {
            newState.currentGuesserId = currentQueue.shift();
            newState.guesserQueue = currentQueue; // บันทึกคิวที่สั้นลงกลับเข้าไป
        } else {
            // ถ้าคิวหมดแล้ว -> เริ่มรอบใหม่
            const newTargetIndex = (newState.roundTargetIndex + 1) % activePlayerIds.length;
            const newTargetId = activePlayerIds[newTargetIndex];
            const newGuesserQueue = activePlayerIds.filter(pId => pId !== newTargetId);
            
            newState.roundTargetIndex = newTargetIndex;
            newState.currentGuesserId = newGuesserQueue.shift();
            newState.guesserQueue = newGuesserQueue; // บันทึกคิวใหม่กลับเข้าไป
            
            newState.lastResult = null; // ล้างผลลัพธ์เก่าเมื่อขึ้นรอบใหม่
        }

        return newState;
    });
}


// --- INITIALIZATION & EVENT LISTENERS ---

function initializeApp() {
    // ใช้ Anonymous Authentication เพื่อให้มี User ID ที่ไม่ซ้ำกัน
    auth.signInAnonymously().then(() => {
        myPlayerId = auth.currentUser.uid;
        console.log("Signed in with Player ID:", myPlayerId);
    }).catch((error) => {
        console.error("Anonymous Auth Error:", error);
        dom.lobby.error.textContent = "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้";
    });

    // --- Lobby Screen Events ---
    dom.buttons.createRoom.addEventListener('click', () => {
        const playerName = dom.inputs.playerName.value.trim();
        if (!playerName) {
            dom.lobby.error.textContent = "กรุณาใส่ชื่อผู้เล่น";
            return;
        }

        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const gameRef = database.ref('games/' + roomId);

        const initialGameState = {
            hostId: myPlayerId,
            gameState: 'waiting',
            players: {
                [myPlayerId]: {
                    id: myPlayerId,
                    name: playerName,
                    isEliminated: false,
                    eliminationTries: 3,
                }
            },
            digitCount: 4, // ค่าเริ่มต้น
        };

        gameRef.set(initialGameState).then(() => {
            currentGameId = roomId;
            listenToGameUpdates(roomId);
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
                    currentGameId = roomId;
                    listenToGameUpdates(roomId);
                });
            } else {
                dom.lobby.error.textContent = "ไม่พบห้องเกมนี้";
            }
        });
    });

    // --- Waiting Room Events ---
    dom.buttons.startGame.addEventListener('click', () => {
        if (gameState.hostId !== myPlayerId) return; // ตรวจสอบว่าเป็น Host หรือไม่

        const gameRef = database.ref('games/' + currentGameId);
        const playerIds = Object.keys(gameState.players);

        // สร้างเลขลับให้ผู้เล่นทุกคน
        const updatedPlayers = { ...gameState.players };
        playerIds.forEach(pId => {
            updatedPlayers[pId].secretNumber = generateSecretNumber(gameState.digitCount);
        });

        // กำหนดเป้าหมายและคิวคนทาย
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
        });
    });

    // --- Game Screen Events ---
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
        if (currentGuess.length !== digitCount) return;

        // ส่ง Action ไปให้ Host ประมวลผล
        if (gameState.hostId === myPlayerId) {
            processGuess({ type: 'GUESS', guess: currentGuess, playerId: myPlayerId });
        } else {
            // ถ้าไม่ใช่ Host ให้ส่ง Action ไปที่ Queue บน Firebase
            const actionsRef = database.ref(`games/${currentGameId}/actions`);
            actionsRef.push({ type: 'GUESS', guess: currentGuess, playerId: myPlayerId });
        }
        currentGuess = ""; // ล้างค่าที่ทาย
    });
    
    // (สามารถเพิ่ม Event Listener สำหรับปุ่ม 'ตุยซะเถอะ' ได้ที่นี่)

    // เริ่มต้นที่หน้า Lobby
    showScreen(dom.screens.lobby);
}

// --- Start the App ---
initializeApp();
