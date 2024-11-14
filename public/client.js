const socket = io();

const loginDiv = document.getElementById('login');
const gameDiv = document.getElementById('game');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const roomNameSpan = document.getElementById('roomName');
const userList = document.getElementById('userList');
const startGameBtn = document.getElementById('startGameBtn');
const gameInfo = document.getElementById('gameInfo');
const currentPlayerSpan = document.getElementById('currentPlayer');
const truthBtn = document.getElementById('truthBtn');
const dareBtn = document.getElementById('dareBtn');
const resultText = document.getElementById('resultText');
const historyList = document.getElementById('historyList');

let currentRoom = '';
let username = '';
let playerOrder = [];
let currentTurn = 0;

// Join room
joinBtn.addEventListener('click', () => {
    username = usernameInput.value.trim();
    currentRoom = roomInput.value.trim();
    if (username && currentRoom) {
        socket.emit('joinRoom', { room: currentRoom, username });
        loginDiv.style.display = 'none';
        gameDiv.style.display = 'block';
        roomNameSpan.textContent = currentRoom;
    } else {
        alert('Please enter your name and room number');
    }
});

// Update user list
socket.on('updateUsers', (users) => {
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user.username;
        userList.appendChild(li);
    });

    // If the current user is the room creator, show the "Start Game" button
    const isRoomCreator = users[0].id === socket.id;
    startGameBtn.style.display = isRoomCreator ? 'block' : 'none';
});

// Start game
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', { room: currentRoom });
});

// Receive game started event
socket.on('gameStarted', (data) => {
    playerOrder = data.playerOrder;
    currentTurn = data.currentTurn;
    gameInfo.style.display = 'block';
    startGameBtn.style.display = 'none';
    updateTurnDisplay();
});

// Update current player display
function updateTurnDisplay() {
    const currentPlayer = playerOrder[currentTurn];
    currentPlayerSpan.textContent = currentPlayer.username;

    if (currentPlayer.id === socket.id) {
        truthBtn.disabled = false;
        dareBtn.disabled = false;
    } else {
        truthBtn.disabled = true;
        dareBtn.disabled = true;
    }
}

// Choose truth
truthBtn.addEventListener('click', () => {
    socket.emit('chooseAction', { room: currentRoom, action: 'truth' });
    truthBtn.disabled = true;
    dareBtn.disabled = true;
});

// Choose dare
dareBtn.addEventListener('click', () => {
    socket.emit('chooseAction', { room: currentRoom, action: 'dare' });
    truthBtn.disabled = true;
    dareBtn.disabled = true;
});

// Receive action result
socket.on('actionResult', ({ action, selected, username }) => {
    resultText.textContent = `${username} chose ${action === 'truth' ? 'Truth' : 'Dare'}: ${selected}`;
    const li = document.createElement('li');
    li.textContent = `${username} chose ${action === 'truth' ? 'Truth' : 'Dare'}: ${selected}`;
    historyList.appendChild(li);
    // Update turn
    currentTurn = (currentTurn + 1) % playerOrder.length;
    updateTurnDisplay();
});
