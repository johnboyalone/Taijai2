import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyANK5rvwlgWc11EvXQRXpsSOO-tGV29pKA",
    authDomain: "taijai2.firebaseapp.com",
    databaseURL: "https://taijai2-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "taijai2",
    storageBucket: "taijai2.appspot.com",
    messagingSenderId: "111291976868",
    appId: "1:111291976868:web:fee4606918ba2bbf93ea31"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const pages = {
    home: document.getElementById('page-home'),
    lobby: document.getElementById('page-lobby'),
    game: document.getElementById('page-game'),
};

const buttons = {
    goToLobby: document.getElementById('btn-go-to-lobby'),
    createRoom: document.getElementById('btn-create-room'),
    leaveRoom: document.getElementById('btn-leave-room'),
    delete: document.getElementById('btn-delete'),
    guess: document.getElementById('btn-guess'),
    readyUp: document.getElementById('btn-ready-up'),
};

const playerNameInput = document.getElementById('player-name-input');
const roomListContainer = document.getElementById('room-list');
const keypadContainer = document.querySelector('.keypad');
const gameRoomName = document.getElementById('game-room-name');
const playerList = document.getElementById('player-list');
const setupSection = document.getElementById('setup-section');
const waitingSection = document.getElementById('waiting-section');
const gameplaySection = document.getElementById('gameplay-section');
const keypadControls = document.getElementById('keypad-controls');
const gameDisplay = document.getElementById('game-display');
const turnIndicator = document.getElementById('turn-indicator');

let playerName = '';
let currentInput = '';
let currentPlayerId = `player_${Math.random().toString(36).substr(2, 9)}`;
let currentRoomId = null;
let roomUnsubscribe = null;

function navigateTo(pageName) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    if (pages[pageName]) {
        pages[pageName].classList.add('active');
    }
}

function createKeypad() {
    keypadContainer.innerHTML = '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];
    keys.forEach(keyText => {
        if (keyText === '') {
            keypadContainer.appendChild(document.createElement('div'));
        } else {
            const keyElement = document.createElement('button');
            keyElement.className = 'key';
            keyElement.textContent = keyText;
            keyElement.addEventListener('click', () => handleKeyPress(keyText));
            keypadContainer.appendChild(keyElement);
        }
    });
}

function handleKeyPress(key) {
    if (currentInput.length < 4) {
        currentInput += key;
        gameDisplay.textContent = currentInput;
    }
}

function handleDelete() {
    currentInput = currentInput.slice(0, -1);
    gameDisplay.textContent = currentInput;
}

function loadRooms() {
    const roomsRef = ref(database, 'rooms');
    onValue(roomsRef, (snapshot) => {
        roomListContainer.innerHTML = '';
        const rooms = snapshot.val();
        if (rooms) {
            Object.keys(rooms).forEach(roomId => {
                const roomData = rooms[roomId];
                const playerCount = roomData.players ? Object.keys(roomData.players).length : 0;
                if (playerCount >= 6 || roomData.status === 'PLAYING') return;

                const roomElement = document.createElement('div');
                roomElement.className = 'room-item';
                roomElement.textContent = `${roomData.name} (${playerCount}/6)`;
                roomElement.addEventListener('click', () => joinRoom(roomId));
                roomListContainer.appendChild(roomElement);
            });
        }
        if (roomListContainer.innerHTML === '') {
            roomListContainer.innerHTML = '<p>ยังไม่มีห้องว่าง, สร้างห้องเลย!</p>';
        }
    });
}

function createRoom() {
    const roomName = prompt("กรุณาตั้งชื่อห้อง:", "ห้องทายเลข");
    if (!roomName || roomName.trim() === '') return;

    const roomsRef = ref(database, 'rooms');
    const newRoomRef = push(roomsRef);

    set(newRoomRef, {
        name: roomName,
        createdAt: serverTimestamp(),
        status: 'WAITING',
        players: {},
        turn: ''
    }).then(() => {
        joinRoom(newRoomRef.key);
    }).catch(error => console.error("สร้างห้องไม่สำเร็จ:", error));
}

function joinRoom(roomId) {
    currentRoomId = roomId;
    const roomRef = ref(database, `rooms/${roomId}`);
    const playerRef = ref(database, `rooms/${roomId}/players/${currentPlayerId}`);

    set(playerRef, { name: playerName, status: 'WAITING' })
        .then(() => {
            onDisconnect(playerRef).remove();
            navigateTo('game');
            resetGameUI();
            roomUnsubscribe = onValue(roomRef, handleRoomUpdate);
        });
}

function leaveRoom() {
    if (currentRoomId && currentPlayerId) {
        const playerRef = ref(database, `rooms/${currentRoomId}/players/${currentPlayerId}`);
        set(playerRef, null);
    }
    if (roomUnsubscribe) {
        roomUnsubscribe();
        roomUnsubscribe = null;
    }
    currentRoomId = null;
    navigateTo('lobby');
}

function handleReadyUp() {
    const secretNumber = generateSecretNumber();
    const playerRef = ref(database, `rooms/${currentRoomId}/players/${currentPlayerId}`);
    set(playerRef, {
        name: playerName,
        status: 'READY',
        secretNumber: secretNumber
    });
}

function generateSecretNumber() {
    let digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let result = '';
    for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * digits.length);
        result += digits.splice(randomIndex, 1)[0];
    }
    return result;
}

function resetGameUI() {
    setupSection.classList.remove('hidden');
    waitingSection.classList.add('hidden');
    gameplaySection.classList.add('hidden');
    keypadControls.classList.add('hidden');
    currentInput = '';
    gameDisplay.textContent = '';
}

function handleRoomUpdate(snapshot) {
    const roomData = snapshot.val();
    if (!roomData) {
        alert("ห้องนี้ถูกปิดแล้ว หรือคุณถูกตัดการเชื่อมต่อ กลับไปที่ล็อบบี้");
        leaveRoom();
        return;
    }

    gameRoomName.textContent = `ห้อง: ${roomData.name}`;
    playerList.innerHTML = '';
    const players = roomData.players || {};
    Object.values(players).forEach(player => {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.innerHTML = `
            <span>${player.name}</span>
            <span class="player-status ${player.status.toLowerCase()}">${player.status}</span>
        `;
        playerList.appendChild(li);
    });

    const me = players[currentPlayerId];
    if (!me) return;

    if (me.status === 'WAITING') {
        setupSection.classList.remove('hidden');
        waitingSection.classList.add('hidden');
        gameplaySection.classList.add('hidden');
        keypadControls.classList.add('hidden');
    } else if (me.status === 'READY') {
        setupSection.classList.add('hidden');
        waitingSection.classList.remove('hidden');
        gameplaySection.classList.add('hidden');
        keypadControls.classList.add('hidden');
    }

    const playerCount = Object.keys(players).length;
    const readyCount = Object.values(players).filter(p => p.status === 'READY').length;

    if (roomData.status === 'WAITING' && playerCount >= 2 && playerCount === readyCount) {
        const firstPlayerId = Object.keys(players)[0];
        set(ref(database, `rooms/${currentRoomId}/status`), 'PLAYING');
        set(ref(database, `rooms/${currentRoomId}/turn`), firstPlayerId);
    }

    if (roomData.status === 'PLAYING') {
        if (keypadContainer.innerHTML === '') {
            createKeypad();
        }
        setupSection.classList.add('hidden');
        waitingSection.classList.add('hidden');
        gameplaySection.classList.remove('hidden');
        keypadControls.classList.remove('hidden');
        
        const turnPlayer = players[roomData.turn];
        turnIndicator.textContent = `ตาของ: ${turnPlayer.name}`;
        buttons.guess.disabled = (roomData.turn !== currentPlayerId);
    }
}

buttons.goToLobby.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name === '') {
        alert('กรุณาตั้งชื่อของคุณก่อน!');
        return;
    }
    playerName = name;
    navigateTo('lobby');
    loadRooms();
});

buttons.createRoom.addEventListener('click', createRoom);
buttons.leaveRoom.addEventListener('click', leaveRoom);
buttons.delete.addEventListener('click', handleDelete);
buttons.readyUp.addEventListener('click', handleReadyUp);
buttons.guess.addEventListener('click', () => {
    if (currentInput.length !== 4) {
        alert('กรุณากรอกเลขให้ครบ 4 หลัก');
        return;
    }
    alert(`ทายเลข: ${currentInput}`);
    currentInput = '';
    gameDisplay.textContent = '';
});

navigateTo('home');
