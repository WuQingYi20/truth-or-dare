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

const approvalSection = document.getElementById('approvalSection');
const approvalText = document.getElementById('approvalText');
const approveBtn = document.getElementById('approveBtn');
const passBtn = document.getElementById('passBtn');

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
        document.getElementById('playerName').textContent = username;
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

    // 如果当前用户是房间创建者，显示“开始游戏”按钮
    const isRoomCreator = users[0].id === socket.id;
    startGameBtn.style.display = isRoomCreator ? 'block' : 'none';
});

// Start game
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', { room: currentRoom });
    startGameBtn.style.display = 'none';
});

// Receive game started event
socket.on('gameStarted', (data) => {
    playerOrder = data.playerOrder;
    currentTurn = data.currentTurn;
    updateTurnDisplay();
    gameInfo.style.display = 'block';
    responseSection.style.display = 'flex';
});

// Update current turn display
function updateTurnDisplay() {
    const currentPlayer = playerOrder[currentTurn];
    currentPlayerSpan.textContent = currentPlayer.username;
    const isCurrentPlayer = currentPlayer.id === socket.id;
    setInteractionMode(isCurrentPlayer);
}

// Choose truth
truthBtn.addEventListener('click', () => {
    socket.emit('chooseAction', { room: currentRoom, action: 'truth' });
    truthBtn.disabled = true;
    dareBtn.disabled = true;
    // 不隐藏输入框
});

// Choose dare
dareBtn.addEventListener('click', () => {
    socket.emit('chooseAction', { room: currentRoom, action: 'dare' });
    truthBtn.disabled = true;
    dareBtn.disabled = true;
    // 不隐藏输入框
});

// Send Text Response
sendTextBtn.addEventListener('click', () => {
    const answer = textResponse.value.trim();
    if (answer) {
        socket.emit('submitAnswer', { room: currentRoom, answer });
        // 清空文本区域
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
    resultText.textContent = `${username} 选择了 ${action === 'truth' ? '真心话' : '大冒险'}: ${selected}`;
    const li = document.createElement('li');
    li.textContent = `${username} 选择了 ${action === 'truth' ? '真心话' : '大冒险'}: ${selected}`;
    historyList.appendChild(li);
    
    // 显示投票区域给所有玩家
    approvalSection.style.display = 'block';
    approvalText.textContent = `${username} 的 ${action === 'truth' ? '真心话' : '大冒险'}: ${selected}`;
    document.getElementById('voteStatus').textContent = '等待投票中...';
    
    // 根据是否是当前玩家来显示或隐藏投票按钮
    const currentPlayer = playerOrder[currentTurn];
    const isCurrentPlayer = currentPlayer.id === socket.id;
    document.querySelector('.vote-buttons').style.display = isCurrentPlayer ? 'none' : 'block';
    
    // 禁用真心话大冒险按钮
    truthBtn.disabled = true;
    dareBtn.disabled = true;
});


// Display approval section
function displayApprovalSection(action, selected, responder) {
    const currentPlayer = playerOrder[currentTurn];
    const isCurrentPlayer = currentPlayer.id === socket.id;
    
    approvalSection.style.display = 'block';
    approvalText.textContent = `${responder} 的 ${action === 'truth' ? '真心话' : '大冒险'}: ${selected}`;
    document.getElementById('voteStatus').textContent = '等待投票中...';
    
    // 如果是当前回答问题的玩家，隐藏投票按钮
    const voteButtons = document.querySelector('.vote-buttons');
    voteButtons.style.display = isCurrentPlayer ? 'none' : 'block';
}

// Approve Answer
approveBtn.addEventListener('click', () => {
    socket.emit('approveAnswer', { room: currentRoom, approval: true });
    approvalSection.style.display = 'none';
    alert('You have approved the answer.');
});

// Pass Answer
passBtn.addEventListener('click', () => {
    socket.emit('approveAnswer', { room: currentRoom, approval: false });
    approvalSection.style.display = 'none';
    alert('You have passed on the answer.');
});

// Receive new answer
socket.on('newAnswer', ({ username, answer }) => {
    const li = document.createElement('li');
    li.textContent = `${username}: ${answer}`;
    responsesList.appendChild(li);
    scrollToBottom();
});

// Receive next turn event
socket.on('nextTurn', ({ currentTurn: newTurn }) => {
    currentTurn = newTurn;
    updateTurnDisplay();
    
    // 重置所有UI状态
    responseSection.style.display = 'flex';
    responsesList.innerHTML = '';
    approvalSection.style.display = 'none';
    document.getElementById('voteStatus').textContent = '';
    document.getElementById('votersList').innerHTML = '';
    
    // 重新启用真心话大冒险按钮（仅对当前玩家）
    const currentPlayer = playerOrder[currentTurn];
    const isCurrentPlayer = currentPlayer.id === socket.id;
    
    truthBtn.disabled = !isCurrentPlayer;
    dareBtn.disabled = !isCurrentPlayer;
    
    // 重置文本输入区域
    textResponse.value = '';
    textResponse.disabled = !isCurrentPlayer;
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
                document.getElementById('playerName').textContent = enteredUsername;
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

// 禁用非当前玩家的输入区域
function setInteractionMode(isCurrentPlayer) {
    if (isCurrentPlayer) {
        truthBtn.disabled = false;
        dareBtn.disabled = false;
        responseSection.style.display = 'flex';
        availableRoomsList.style.display = 'none';
    } else {
        truthBtn.disabled = true;
        dareBtn.disabled = true;
        responseSection.style.display = 'flex';
        availableRoomsList.style.display = 'block';
    }
}

// 接收审批请求
socket.on('requestApproval', ({ from, action, selected }) => {
    approvalSection.style.display = 'block';
    approvalText.textContent = `${from} 的 ${action === 'truth' ? '真心话' : '大冒险'}: ${selected}`;
});

// 自动调整 textarea 高度的函数
function autoResize(textarea) {
    textarea.style.height = 'auto'; // 先重置高度
    textarea.style.height = textarea.scrollHeight + 'px'; // 根据内容设置高度
}

// 可选：在页面加载完成后为 textarea 添加事件监听器
document.addEventListener('DOMContentLoaded', () => {
    const textResponse = document.getElementById('textResponse');
    textResponse.addEventListener('input', function() {
        autoResize(this);
    });
});

// 处理提交答案
socket.on('submitAnswer', ({ room, answer }) => {
    const roomData = rooms[room];
    if (roomData && roomData.gameStarted && roomData.pendingApproval) {
        const currentPlayer = roomData.playerOrder[roomData.currentTurn];
        if (currentPlayer.id === socket.id) {
            // 这里可以保存或处理玩家的答案
            io.to(room).emit('newAnswer', { username: currentPlayer.username, answer });
            // 在此轮次中，答案已提交，等待所有玩家的批准
        }
    }
});

// 添加投票状态更新处理
socket.on('voteUpdate', ({ approvedCount, rejectedCount, totalVoters, requiredVotes, voters }) => {
    const voteStatus = document.getElementById('voteStatus');
    const votersList = document.getElementById('votersList');
    const currentPlayer = playerOrder[currentTurn];
    const isCurrentPlayer = currentPlayer.id === socket.id;
    
    // 更新投票状态显示
    voteStatus.textContent = `当前投票情况：通过 ${approvedCount} / 不通过 ${rejectedCount} (需要${requiredVotes}票通过)`;
    
    // 更新投票者列表
    votersList.innerHTML = '';
    Object.entries(voters).forEach(([voterId, { username, vote }]) => {
        const li = document.createElement('li');
        li.textContent = `${username}: ${vote ? '通过' : '不通过'}`;
        li.className = vote ? 'vote-approve' : 'vote-reject';
        votersList.appendChild(li);
    });

    // 如果是当前玩家,隐藏投票按钮但显示投票状态
    if (isCurrentPlayer) {
        document.querySelector('.vote-buttons').style.display = 'none';
    }
});

// 修改投票结果处理
socket.on('voteResult', ({ passed, approvedCount, rejectedCount, totalVoters, requiredVotes }) => {
    const resultMessage = document.createElement('div');
    resultMessage.className = passed ? 'vote-result success' : 'vote-result failure';
    
    if (passed) {
        resultMessage.textContent = `投票通过！(${approvedCount}/${totalVoters}票同意)`;
        approvalSection.style.display = 'none';
        // 清空投票状态
        document.getElementById('voteStatus').textContent = '';
        document.getElementById('votersList').innerHTML = '';
    } else {
        resultMessage.textContent = `投票未通过，需要重新回答。(${approvedCount}/${totalVoters}票同意，需要${requiredVotes}票)`;
        
        // 重置投票状态
        document.getElementById('voteStatus').textContent = '等待重新投票中...';
        document.getElementById('votersList').innerHTML = '';
        
        // 重新显示投票区域
        approvalSection.style.display = 'block';
        
        // 获取当前玩家状态
        const currentPlayer = playerOrder[currentTurn];
        const isCurrentPlayer = currentPlayer.id === socket.id;
        
        // 处理投票按钮显示
        const voteButtons = document.querySelector('.vote-buttons');
        if (isCurrentPlayer) {
            voteButtons.style.display = 'none';
        } else {
            voteButtons.style.display = 'block';
            // 重置按钮状态
            approveBtn.disabled = false;
            passBtn.disabled = false;
        }
    }
    
    // 显示结果消息
    gameInfo.insertBefore(resultMessage, gameInfo.firstChild);
    setTimeout(() => resultMessage.remove(), 3000);
});

// 重置答案区域
function resetAnswerSection() {
    textResponse.value = '';
    textResponse.disabled = false;
    sendTextBtn.disabled = false;
    startVoiceBtn.disabled = false;
    responseSection.style.display = 'flex';
}

// 在文档加载完成后添加
document.addEventListener('DOMContentLoaded', () => {
    const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
    const historyContent = document.getElementById('historyContent');
    
    toggleHistoryBtn.addEventListener('click', () => {
        const isHidden = historyContent.style.display === 'none';
        historyContent.style.display = isHidden ? 'block' : 'none';
        toggleHistoryBtn.textContent = isHidden ? '隐藏历史记录' : '显示历史记录';
    });
});

socket.on('approveAnswer', ({ room, approval }) => {
    const roomData = rooms[room];
    if (roomData && roomData.pendingApproval) {
        // 记录投票
        const voter = roomData.users.find(u => u.id === socket.id);
        roomData.votingStatus.voters[socket.id] = {
            vote: approval,
            username: voter.username
        };
        
        // 计算投票数
        const votes = Object.values(roomData.votingStatus.voters);
        const approvedCount = votes.filter(v => v.vote === true).length;
        const rejectedCount = votes.filter(v => v.vote === false).length;
        
        // 计算所需票数（不包括当前回答者）
        const totalVoters = roomData.users.length - 1;
        const requiredVotes = totalVoters <= 2 ? totalVoters : Math.ceil(totalVoters / 2);
        
        // 广播当前投票状态
        io.to(room).emit('voteUpdate', {
            approvedCount,
            rejectedCount,
            totalVoters,
            requiredVotes,
            voters: roomData.votingStatus.voters
        });
        
        // 检查是否所有人都已投票
        if (approvedCount + rejectedCount === totalVoters) {
            const passed = approvedCount >= requiredVotes;
            io.to(room).emit('voteResult', {
                passed,
                approvedCount,
                rejectedCount,
                totalVoters,
                requiredVotes
            });
            
            if (passed) {
                // 通过，进入下一轮
                roomData.currentTurn = (roomData.currentTurn + 1) % roomData.playerOrder.length;
                io.to(room).emit('nextTurn', { currentTurn: roomData.currentTurn });
            } else {
                // 未通过，重置投票状态
                roomData.votingStatus = {
                    approvedCount: 0,
                    rejectedCount: 0,
                    voters: {},
                    totalRequired: requiredVotes
                };
            }
        }
    }
});

function scrollToBottom() {
    window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
    });
}
