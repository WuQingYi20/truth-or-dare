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
const availableRoomsList = document.getElementById('availableRooms');

const responseSection = document.getElementById('responseSection');
const textResponse = document.getElementById('textResponse');
const sendTextBtn = document.getElementById('sendTextBtn');
const startVoiceBtn = document.getElementById('startVoiceBtn');
const stopVoiceBtn = document.getElementById('stopVoiceBtn');
const responsesList = document.getElementById('responsesList');

let currentRoom = '';
let username = '';
let playerOrder = [];
let currentTurn = 0;

// Speech Recognition Setup
let recognition;
let isListening = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        textResponse.value = transcript;
        sendVoiceResponse(transcript);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        alert('Voice recognition error. Please try again.');
        stopVoice();
    };

    recognition.onend = () => {
        if (isListening) {
            stopVoice();
        }
    };
} else {
    alert('Your browser does not support Speech Recognition. Voice responses will not be available.');
}

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
        responseSection.style.display = 'block';
    } else {
        truthBtn.disabled = true;
        dareBtn.disabled = true;
        responseSection.style.display = 'none';
    }
}

// Choose truth
truthBtn.addEventListener('click', () => {
    socket.emit('chooseAction', { room: currentRoom, action: 'truth' });
    truthBtn.disabled = true;
    dareBtn.disabled = true;
    responseSection.style.display = 'none';
});

// Choose dare
dareBtn.addEventListener('click', () => {
    socket.emit('chooseAction', { room: currentRoom, action: 'dare' });
    truthBtn.disabled = true;
    dareBtn.disabled = true;
    responseSection.style.display = 'none';
});

// Send Text Response
sendTextBtn.addEventListener('click', () => {
    const answer = textResponse.value.trim();
    if (answer) {
        socket.emit('submitAnswer', { room: currentRoom, answer });
        // Clear the text area after sending
        textResponse.value = '';
    } else {
        alert('Please enter your answer before sending.');
    }
});

// Start Voice Response
startVoiceBtn.addEventListener('click', () => {
    if (recognition && !isListening) {
        recognition.start();
        isListening = true;
        startVoiceBtn.disabled = true;
        stopVoiceBtn.disabled = false;
        console.log('Voice recognition started.');
    }
});

// Stop Voice Response
stopVoiceBtn.addEventListener('click', () => {
    stopVoice();
});

function stopVoice() {
    if (recognition && isListening) {
        recognition.stop();
        isListening = false;
        startVoiceBtn.disabled = false;
        stopVoiceBtn.disabled = true;
        console.log('Voice recognition stopped.');
    }
}

// Handle voice response result
function sendVoiceResponse(transcript) {
    socket.emit('submitAnswer', { room: currentRoom, answer: transcript });
}

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

// Receive new answer
socket.on('newAnswer', ({ username, answer }) => {
    const li = document.createElement('li');
    li.textContent = `${username}: ${answer}`;
    responsesList.appendChild(li);
});

// Receive room list and display available rooms
socket.on('roomList', (rooms) => {
    availableRoomsList.innerHTML = '';
    if (rooms.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No available rooms.';
        availableRoomsList.appendChild(li);
    } else {
        rooms.forEach(room => {
            const li = document.createElement('li');
            const joinRoomBtn = document.createElement('button');
            joinRoomBtn.textContent = room;
            joinRoomBtn.addEventListener('click', () => {
                const enteredUsername = usernameInput.value.trim();
                if (!enteredUsername) {
                    alert('Please enter your name before joining a room.');
                    return;
                }
                socket.emit('joinRoom', { room, username: enteredUsername });
                currentRoom = room;
                loginDiv.style.display = 'none';
                gameDiv.style.display = 'block';
                roomNameSpan.textContent = currentRoom;
            });
            li.appendChild(joinRoomBtn);
            availableRoomsList.appendChild(li);
        });
    }
});

// Request the list of rooms when the page loads
window.addEventListener('load', () => {
    socket.emit('getRooms');
});

// Optionally, you can periodically request the room list to keep it updated
setInterval(() => {
    socket.emit('getRooms');
}, 5000);
