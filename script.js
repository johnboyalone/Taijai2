// script.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue, push, onDisconnect, serverTimestamp, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

const inputs = {
    playerName: document.getElementById('input-player-name'),
};

const roomListContainer = document.getElementById('room-list');
const keypadContainer = document.querySelector('.keypad');
const gameRoomName = document.getElementById('game-room-name');
const playerList = document.getElementById('player-list');
const setupSection = document.getElementById('setup-section');
const waitingSection = document.getElementById('waiting-section');
const gameplaySection = document.getElementById('gameplay-section');
const keypadControls = document.getElementById('keypad-controls');
const gameDisplay = document.getElementById('game-display');
const secretNumberDisplayText = document.getElementById('secret-number-display-text');

let currentPlayerId = sessionStorage.getItem('playerId');
if (!currentPlayerId) {
    currentPlayerId = `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    sessionStorage.setItem('playerId', currentPlayerId);
}

let currentRoomId = null;
let playerName = '';
let currentInput = '';
let playerRef = null;
let roomRef = null;
let roomUnsubscribe = null; // ตัวแปรสำหรับยกเลิกการฟังข้อมูล

function navigateTo(pageName) {
    Object.values(pages).forEach(page => page.style.display = 'none');
    if (pages[pageName]) {
        pages[pageName].style.display = 'block';
    }
}

function goToLobby() {
    const name = inputs.playerName.value.trim();
    if (!name) {
        alert('กรุณาตั้งชื่อผู้เล่นของคุณ');
        return;
    }
    playerName = name;
    sessionStorage.setItem('playerName', playerName);
    navigateTo('lobby');
    loadRooms();
}

function loadRooms() {
    const roomsRef = ref(database, 'rooms');
    onValue(roomsRef, (snapshot) => {
        roomListContainer.innerHTML = '';
        const rooms = snapshot.val();
        if (rooms) {
            Object.entries(rooms).forEach(([roomId, roomData]) => {
                if (roomData.status === 'WAITING') {
                    const roomElement = document.createElement('div');
                    roomElement.className = 'room-item';
                    const playerCount = roomData.players ? Object.keys(roomData.players).length : 0;
                    roomElement.innerHTML = `
                        <span>${roomData.name}</span>
                        <span>(${playerCount}/6)</span>
                    `;
                    roomElement.addEventListener('click', () => joinRoom(roomId));
                    roomListContainer.appendChild(roomElement);
                }
            });
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
    }).catch(error => console.error("สร้างห้องไม่สำเร็จ:", error));
}

function joinRoom(roomId) {
    if (!playerName) {
        alert('เกิดข้อผิดพลาด: ไม่พบชื่อผู้เล่น กรุณากลับไปหน้าแรก');
        navigateTo('home');
        return;
    }
    currentRoomId = roomId;
    roomRef = ref(database, `rooms/${currentRoomId}`);
    playerRef = ref(database, `rooms/${currentRoomId}/players/${currentPlayerId}`);

    const playerData = {
        name: playerName,
        isReady: false,
        secretNumber: '',
    };

    set(playerRef, playerData)
        .then(() => {
            onDisconnect(playerRef).remove();
            navigateTo('game');
            if (roomUnsubscribe) roomUnsubscribe(); // ยกเลิกการฟังเก่าก่อน
            roomUnsubscribe = onValue(roomRef, handleRoomUpdate);
        })
        .catch(error => console.error("เข้าร่วมห้องไม่สำเร็จ:", error));
}

function leaveRoom() {
    if (playerRef) {
        remove(playerRef);
    }
    if (roomUnsubscribe) {
        roomUnsubscribe(); // ยกเลิกการฟังข้อมูลห้อง
        roomUnsubscribe = null;
    }
    playerRef = null;
    roomRef = null;
    currentRoomId = null;
    navigateTo('lobby'); // กลับไปหน้าล็อบบี้
}

function handleRoomUpdate(snapshot) {
    const roomData = snapshot.val();
    if (!roomData) {
        alert("ห้องถูกปิดแล้ว หรือคุณได้ออกจากห้องแล้ว");
        leaveRoom();
        return;
    }

    gameRoomName.textContent = `ห้อง: ${roomData.name}`;
    const players = roomData.players || {};
    const playerCount = Object.keys(players).length;

    if (playerCount === 0 && currentRoomId) {
        remove(ref(database, `rooms/${currentRoomId}`));
        return;
    }

    const me = players[currentPlayerId];
    if (!me) {
        // ถ้าไม่เจอข้อมูลตัวเองในห้อง อาจเป็นเพราะเพิ่งกดออก
        return;
    }

    playerList.innerHTML = '';
    Object.values(players).forEach(p => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-list-item';
        playerElement.innerHTML = `
            <span>ผู้เล่น ${p.name}</span>
            <span class="status ${p.isReady ? 'ready' : 'waiting'}">
                ${p.isReady ? 'READY' : 'WAITING'}
            </span>
        `;
        playerList.appendChild(playerElement);
    });

    const allReady = Object.values(players).every(p => p.isReady);

    if (roomData.status === 'WAITING') {
        if (me.isReady) {
            setupSection.style.display = 'none';
            waitingSection.style.display = 'block';
        } else {
            setupSection.style.display = 'block';
            waitingSection.style.display = 'none';
        }
        gameplaySection.style.display = 'none';
        
        if (allReady && playerCount >= 2) {
            set(ref(database, `rooms/${currentRoomId}/status`), 'PLAYING');
        }
    } else if (roomData.status === 'PLAYING') {
        setupSection.style.display = 'none';
        waitingSection.style.display = 'none';
        gameplaySection.style.display = 'block';
    }
}

function handleReadyUp() {
    const secretNumber = generateSecretNumber();
    secretNumberDisplayText.textContent = secretNumber; // แสดงเลขลับให้ผู้เล่นเห็น
    
    const updates = {};
    updates[`rooms/${currentRoomId}/players/${currentPlayerId}/secretNumber`] = secretNumber;
    updates[`rooms/${currentRoomId}/players/${currentPlayerId}/isReady`] = true;
    
    set(ref(database), updates);
}

function generateSecretNumber() {
    let number = '';
    const digits = '0123456789'.split('');
    for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * digits.length);
        number += digits.splice(randomIndex, 1)[0];
    }
    return number;
}

function handleKeypadClick(e) {
    if (!e.target.matches('[data-key]')) return;
    const key = e.target.dataset.key;
    if (currentInput.length < 4) {
        currentInput += key;
        gameDisplay.textContent = currentInput;
    }
}

function handleDelete() {
    currentInput = currentInput.slice(0, -1);
    gameDisplay.textContent = currentInput;
}

// --- Event Listeners ---
buttons.goToLobby.addEventListener('click', goToLobby);
buttons.createRoom.addEventListener('click', createRoom);
buttons.leaveRoom.addEventListener('click', leaveRoom);
buttons.delete.addEventListener('click', handleDelete);
buttons.readyUp.addEventListener('click', handleReadyUp);
keypadContainer.addEventListener('click', handleKeypadClick);

buttons.guess.addEventListener('click', () => {
    if (currentInput.length !== 4) {
        alert('กรุณากรอกเลขให้ครบ 4 หลัก');
        return;
    }
    alert(`ทายเลข: ${currentInput}`);
    currentInput = '';
    gameDisplay.textContent = '';
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    const savedPlayerName = sessionStorage.getItem('playerName');
    if (savedPlayerName) {
        inputs.playerName.value = savedPlayerName;
        playerName = savedPlayerName;
    }
    navigateTo('home');
});
