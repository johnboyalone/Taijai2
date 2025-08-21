// =================================================================
//  ส่วนที่ 1: การตั้งค่า Firebase และการเชื่อมต่อ
// =================================================================

// --- !!! สำคัญมาก !!! ---
//  วาง Firebase Config ของคุณลงในนี้
//  คุณสามารถคัดลอกค่านี้ได้จาก Project Settings > General ใน Firebase Console ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyANK5rvwlgWc11EvXQRXpsSOO-tGV29pKA",
  authDomain: "taijai2.firebaseapp.com",
  databaseURL: "https://taijai2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "taijai2",
  storageBucket: "taijai2.firebasestorage.app",
  messagingSenderId: "111291976868",
  appId: "1:111291976868:web:fee4606918ba2bbf93ea31"
};

// เริ่มการเชื่อมต่อ Firebase (ใช้เวอร์ชัน 8)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// =================================================================
//  ส่วนที่ 2: การเข้าถึงองค์ประกอบ HTML (DOM Elements)
// =================================================================

const screens = document.querySelectorAll('.screen');
const splashScreen = document.getElementById('splash-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const waitingRoomScreen = document.getElementById('waiting-room-screen');
const gameScreen = document.getElementById('game-screen');
const endGameScreen = document.getElementById('end-game-screen');

// ปุ่มและ Input
const playerNameInput = document.getElementById('player-name-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomInput = document.getElementById('join-room-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const startGameBtn = document.getElementById('start-game-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const guessBtn = document.getElementById('guess-btn');
const finalGuessBtn = document.getElementById('final-guess-btn');
const playAgainBtn = document.getElementById('play-again-btn');

// ส่วนแสดงผล
const roomCodeDisplay = document.getElementById('room-code-display');
const playerListWaiting = document.getElementById('player-list-waiting');
const turnInfo = document.getElementById('turn-info');
const timerText = document.getElementById('timer-text');
const timerCircle = document.getElementById('timer-circle');
const playersDisplayArea = document.getElementById('players-display-area');
const guessInputDisplay = document.getElementById('guess-input-display').children;
const numpad = document.getElementById('numpad');
const winnerName = document.getElementById('winner-name');
const playerTitles = document.getElementById('player-titles');

// Popups และ Modals
const chatPopup = document.getElementById('chat-popup');
const chatHeader = document.getElementById('chat-header');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const historyPopup = document.getElementById('history-popup');
const historyHeader = document.getElementById('history-header');
const howToPlayModal = document.getElementById('how-to-play-modal');
const confirmationModal = document.getElementById('confirmation-modal');

// =================================================================
//  ส่วนที่ 3: ตัวแปรสถานะของเกม (Game State)
// =================================================================

let currentPlayer = null; // { id, name }
let currentRoomId = null;
let roomUnsubscribe = null; // Function to stop listening to room updates
let currentGuess = [];
let isHost = false;
let gameData = {}; // จะเก็บข้อมูลเกมทั้งหมดจาก Firestore

// =================================================================
//  ส่วนที่ 4: ฟังก์ชันหลักในการจัดการหน้าจอและ UI
// =================================================================

// ฟังก์ชันเปลี่ยนหน้าจอ
function showScreen(screenId) {
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// ฟังก์ชันสร้าง Numpad
function createNumpad() {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'ลบ', 0, 'ทาย'];
    numpad.innerHTML = '';
    numbers.forEach(num => {
        const button = document.createElement('button');
        button.textContent = num;
        if (typeof num === 'number') {
            button.onclick = () => handleNumpadInput(num.toString());
        } else if (num === 'ลบ') {
            button.onclick = handleBackspace;
        } else if (num === 'ทาย') {
            button.onclick = () => guessBtn.click(); // ทำเหมือนกดปุ่มทายจริง
        }
        numpad.appendChild(button);
    });
}

// ฟังก์ชันอัปเดตช่องแสดงตัวเลขที่ทาย
function updateGuessDisplay() {
    for (let i = 0; i < 4; i++) {
        guessInputDisplay[i].textContent = currentGuess[i] || '';
    }
}

// ฟังก์ชันจัดการการกด Numpad
function handleNumpadInput(num) {
    if (currentGuess.length < 4) {
        currentGuess.push(num);
        updateGuessDisplay();
    }
}

// ฟังก์ชันจัดการการกดลบ
function handleBackspace() {
    if (currentGuess.length > 0) {
        currentGuess.pop();
        updateGuessDisplay();
    }
}

// ฟังก์ชันแสดง Modal ยืนยัน
function showConfirmation(text, onConfirm) {
    document.getElementById('confirmation-text').textContent = text;
    confirmationModal.classList.add('active');
    
    const yesBtn = document.getElementById('confirm-yes-btn');
    const noBtn = document.getElementById('confirm-no-btn');

    const confirmHandler = () => {
        onConfirm();
        hideConfirmation();
        cleanup();
    };

    const cancelHandler = () => {
        hideConfirmation();
        cleanup();
    };
    
    const cleanup = () => {
        yesBtn.removeEventListener('click', confirmHandler);
        noBtn.removeEventListener('click', cancelHandler);
    };

    yesBtn.addEventListener('click', confirmHandler);
    noBtn.addEventListener('click', cancelHandler);
}

function hideConfirmation() {
    confirmationModal.classList.remove('active');
}

// =================================================================
//  ส่วนที่ 5: ตรรกะการจัดการห้อง (Lobby & Room Logic)
// =================================================================

// สร้างห้องใหม่
async function createRoom() {
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('กรุณาใส่ชื่อของคุณ');
        return;
    }

    isHost = true;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    currentRoomId = roomId;

    const newPlayer = {
        id: `player_${Date.now()}`,
        name: playerName,
        isHost: true,
        status: 'alive',
        lives: 3,
        secretCode: [],
    };
    currentPlayer = { id: newPlayer.id, name: newPlayer.name };

    const roomData = {
        roomName: `${playerName}'s Room`,
        playerCount: 1,
        status: 'waiting',
        hostId: newPlayer.id,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
        await db.collection('rooms').doc(roomId).set(roomData);
        await db.collection('rooms').doc(roomId).collection('players').doc(newPlayer.id).set(newPlayer);
        await listenToRoomUpdates(roomId);
        showScreen('waiting-room-screen');
    } catch (error) {
        console.error("Error creating room: ", error);
        alert('ไม่สามารถสร้างห้องได้');
    }
}

// เข้าร่วมห้อง
async function joinRoom() {
    const playerName = playerNameInput.value.trim();
    const roomId = joinRoomInput.value.trim().toUpperCase();

    if (!playerName || !roomId) {
        alert('กรุณาใส่ชื่อและรหัสห้อง');
        return;
    }

    const roomRef = db.collection('rooms').doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
        alert('ไม่พบห้องนี้');
        return;
    }
    
    const roomData = roomDoc.data();
    if (roomData.status !== 'waiting') {
        alert('ห้องนี้เริ่มเล่นไปแล้วหรือไม่ว่าง');
        return;
    }
    if (roomData.playerCount >= 6) {
        alert('ห้องนี้เต็มแล้ว');
        return;
    }

    isHost = false;
    currentRoomId = roomId;
    
    const newPlayer = {
        id: `player_${Date.now()}`,
        name: playerName,
        isHost: false,
        status: 'alive',
        lives: 3,
        secretCode: [],
    };
    currentPlayer = { id: newPlayer.id, name: newPlayer.name };

    try {
        await roomRef.collection('players').doc(newPlayer.id).set(newPlayer);
        await roomRef.update({ playerCount: firebase.firestore.FieldValue.increment(1) });
        await listenToRoomUpdates(roomId);
        showScreen('waiting-room-screen');
    } catch (error) {
        console.error("Error joining room: ", error);
        alert('ไม่สามารถเข้าร่วมห้องได้');
    }
}

// ออกจากห้อง
async function leaveRoom() {
    if (!currentRoomId || !currentPlayer) return;

    const playerRef = db.collection('rooms').doc(currentRoomId).collection('players').doc(currentPlayer.id);
    await playerRef.delete();
    
    await db.collection('rooms').doc(currentRoomId).update({
        playerCount: firebase.firestore.FieldValue.increment(-1)
    });

    // หาก Host ออก, ต้องเลือก Host ใหม่ หรือลบห้อง
    if (isHost) {
        // (ตรรกะเพิ่มเติม: เลือก Host ใหม่ หรือลบห้องถ้าไม่มีใครอยู่)
    }

    if (roomUnsubscribe) roomUnsubscribe();
    currentRoomId = null;
    currentPlayer = null;
    isHost = false;
    showScreen('lobby-screen');
}

// ฟังก์ชัน "ฟัง" การเปลี่ยนแปลงในห้อง
function listenToRoomUpdates(roomId) {
    roomUnsubscribe = db.collection('rooms').doc(roomId).collection('players')
        .onSnapshot(snapshot => {
            const players = [];
            snapshot.forEach(doc => players.push(doc.data()));
            gameData.players = players; // อัปเดตข้อมูลเกม
            updateWaitingRoomUI(players);
            
            // ถ้าอยู่ในหน้าเกม ก็อัปเดต UI เกมด้วย
            if (gameScreen.classList.contains('active')) {
                updateGameUI();
            }
        });
    
    // (ควรมี listener สำหรับ document ของห้องด้วยเพื่อดู status)
}

// อัปเดต UI ห้องรอ
function updateWaitingRoomUI(players) {
    roomCodeDisplay.textContent = currentRoomId;
    playerListWaiting.innerHTML = '';
    players.forEach(p => {
        const playerElement = document.createElement('div');
        playerElement.textContent = `${p.name} ${p.isHost ? '(Host)' : ''}`;
        playerListWaiting.appendChild(playerElement);
    });
    document.getElementById('current-players').textContent = players.length;
    startGameBtn.style.display = isHost ? 'block' : 'none';
}
// =================================================================
//  ส่วนที่ 6: ตรรกะหลักของเกม (Core Game Logic)
// =================================================================

// เริ่มเกม (โดย Host)
async function startGame() {
    if (!isHost || !currentRoomId) return;

    // 1. สร้างรหัสลับให้ทุกคน
    const players = gameData.players;
    const batch = db.batch();
    players.forEach(p => {
        const secretCode = Array.from({length: 4}, () => Math.floor(Math.random() * 10).toString());
        const playerRef = db.collection('rooms').doc(currentRoomId).collection('players').doc(p.id);
        batch.update(playerRef, { secretCode: secretCode });
    });
    
    // 2. กำหนดตาแรก และเปลี่ยนสถานะเกม
    const firstTurnPlayerId = players[0].id;
    const roomRef = db.collection('rooms').doc(currentRoomId);
    batch.update(roomRef, {
        status: 'playing',
        currentPlayerTurn: firstTurnPlayerId,
        turnStartTime: firebase.firestore.FieldValue.serverTimestamp(),
        round: 1,
        turnOrder: players.map(p => p.id) // เก็บเรียงลำดับตา
    });

    await batch.commit();
    // Listener จะจับการเปลี่ยนแปลงและอัปเดต UI เอง
    showScreen('game-screen');
}

// ฟังก์ชันอัปเดต UI หน้าเกม
function updateGameUI() {
    if (!gameData || !gameData.players) return;

    // อัปเดตข้อมูลตาปัจจุบัน
    const targetPlayer = gameData.players.find(p => p.id === gameData.currentPlayerTurn);
    if (targetPlayer) {
        turnInfo.textContent = `รอบทาย: ${targetPlayer.name}`;
    }

    // อัปเดตการแสดงผลผู้เล่น
    playersDisplayArea.innerHTML = '';
    gameData.players.forEach(p => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-icon';
        if (p.status === 'dead') playerDiv.classList.add('dead');
        if (p.id === gameData.currentPlayerTurn) playerDiv.classList.add('target');
        // (เพิ่ม class 'guesser' สำหรับคนที่กำลังจะทาย)

        const avatar = document.createElement('div');
        avatar.className = 'player-avatar';
        avatar.textContent = p.name.substring(0, 1);

        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = p.name;

        const lives = document.createElement('div');
        lives.className = 'player-lives';
        lives.textContent = '❤️'.repeat(p.lives);

        playerDiv.appendChild(avatar);
        playerDiv.appendChild(name);
        playerDiv.appendChild(lives);
        playersDisplayArea.appendChild(playerDiv);
    });
}

// ส่งคำทาย
async function submitGuess(isFinalGuess = false) {
    if (currentGuess.length !== 4) {
        alert('กรุณาใส่ตัวเลขให้ครบ 4 หลัก');
        return;
    }

    const targetPlayer = gameData.players.find(p => p.id === gameData.currentPlayerTurn);
    const secret = targetPlayer.secretCode;
    
    // ตรวจสอบคำตอบ
    let correct = 0;
    let misplaced = 0;
    const secretCopy = [...secret];
    const guessCopy = [...currentGuess];

    // เช็คตัวที่ถูกเป๊ะ (Correct)
    for (let i = 3; i >= 0; i--) {
        if (guessCopy[i] === secretCopy[i]) {
            correct++;
            secretCopy.splice(i, 1);
            guessCopy.splice(i, 1);
        }
    }

    // เช็คตัวที่เพี้ยน (Misplaced)
    for (let i = 0; i < guessCopy.length; i++) {
        const foundIndex = secretCopy.indexOf(guessCopy[i]);
        if (foundIndex > -1) {
            misplaced++;
            secretCopy.splice(foundIndex, 1);
        }
    }

    // จัดการผลลัพธ์
    if (isFinalGuess) {
        if (correct === 4) {
            // สังหารสำเร็จ
            await eliminatePlayer(targetPlayer.id);
        } else {
            // สังหารล้มเหลว, เสียเลือด
            await loseLife(currentPlayer.id, 'สังหารพลาดเป้า!');
        }
    } else {
        // ทายปกติ, บันทึกประวัติ
        // (เพิ่มตรรกะบันทึกประวัติการทายที่นี่)
        alert(`ผล: ถูกเป๊ะ ${correct} ตัว, เพี้ยน ${misplaced} ตัว`);
    }
    
    currentGuess = [];
    updateGuessDisplay();
    // (เพิ่มตรรกะเปลี่ยนตาคนทาย)
}

async function eliminatePlayer(playerId) {
    const playerRef = db.collection('rooms').doc(currentRoomId).collection('players').doc(playerId);
    await playerRef.update({ status: 'dead', lives: 0 });
    // (เช็คว่าเหลือผู้ชนะคนเดียวหรือยัง)
}

async function loseLife(playerId, reason) {
    alert(reason);
    const playerRef = db.collection('rooms').doc(currentRoomId).collection('players').doc(playerId);
    const playerDoc = await playerRef.get();
    if (playerDoc.data().lives - 1 <= 0) {
        await eliminatePlayer(playerId);
    } else {
        await playerRef.update({ lives: firebase.firestore.FieldValue.increment(-1) });
    }
}

// =================================================================
//  ส่วนที่ 7: การผูก Event Listeners
// =================================================================

function initializeEventListeners() {
    splashScreen.addEventListener('click', () => showScreen('lobby-screen'));
    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', joinRoom);
    leaveRoomBtn.addEventListener('click', leaveRoom);
    startGameBtn.addEventListener('click', startGame);
    
    guessBtn.addEventListener('click', () => submitGuess(false));
    finalGuessBtn.addEventListener('click', () => {
        showConfirmation('คุณแน่ใจหรือไม่ที่จะส่งคำตอบสุดท้าย? หากผิดจะเสีย 1 ชีวิต!', () => {
            submitGuess(true);
        });
    });

    // Event listeners สำหรับ Popups และ Modals
    chatHeader.addEventListener('click', () => chatPopup.classList.toggle('open'));
    historyHeader.addEventListener('click', () => historyPopup.classList.toggle('open'));
    
    document.getElementById('how-to-play-btn').onclick = () => howToPlayModal.classList.add('active');
    document.querySelector('#how-to-play-modal .close-btn').onclick = () => howToPlayModal.classList.remove('active');
    document.getElementById('confirm-no-btn').onclick = hideConfirmation;
}

// =================================================================
//  ส่วนที่ 8: การเริ่มต้นเกม
// =================================================================

function init() {
    showScreen('splash-screen');
    createNumpad();
    initializeEventListeners();
}

// เริ่มเกมเมื่อโหลดหน้าเว็บเสร็จ
window.onload = init;
