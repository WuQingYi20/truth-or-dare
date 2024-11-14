// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// 读取真心话和大冒险的问题
const truths = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'truths.json')));
const dares = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'dares.json')));

// 存储房间信息
let rooms = {};

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 创建或加入房间
    socket.on('joinRoom', ({ room, username }) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = { users: [], gameStarted: false, playerOrder: [], currentTurn: 0 };
        }
        rooms[room].users.push({ id: socket.id, username });
        io.to(room).emit('updateUsers', rooms[room].users);
        console.log(`${username} joined room: ${room}`);

        // 广播房间列表
        io.emit('roomList', Object.keys(rooms));
    });

    // 开始游戏
    socket.on('startGame', ({ room }) => {
        if (rooms[room] && !rooms[room].gameStarted) {
            rooms[room].gameStarted = true;
            // 随机排列玩家顺序
            rooms[room].playerOrder = rooms[room].users.sort(() => Math.random() - 0.5);
            rooms[room].currentTurn = 0;
            io.to(room).emit('gameStarted', { playerOrder: rooms[room].playerOrder, currentTurn: rooms[room].currentTurn });
            console.log(`Game started in room: ${room}`);
        }
    });

    // 处理选择真心话或大冒险
    socket.on('chooseAction', ({ room, action }) => {
        const roomData = rooms[room];
        if (roomData && roomData.gameStarted) {
            const currentPlayer = roomData.playerOrder[roomData.currentTurn];
            if (currentPlayer.id === socket.id) {
                let selected;
                if (action === 'truth') {
                    selected = truths[Math.floor(Math.random() * truths.length)];
                } else {
                    selected = dares[Math.floor(Math.random() * dares.length)];
                }
                io.to(room).emit('actionResult', { action, selected, username: currentPlayer.username });
                
                // 更新 currentTurn 以轮到下一个玩家
                roomData.currentTurn = (roomData.currentTurn + 1) % roomData.playerOrder.length;

                // 广播房间列表
                io.emit('roomList', Object.keys(rooms));
            }
        }
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        for (let room in rooms) {
            const roomData = rooms[room];
            roomData.users = roomData.users.filter(user => user.id !== socket.id);
            // 如果游戏已经开始，移除玩家顺序中的用户
            if (roomData.gameStarted) {
                roomData.playerOrder = roomData.playerOrder.filter(user => user.id !== socket.id);
                // 调整 currentTurn
                if (roomData.currentTurn >= roomData.playerOrder.length) {
                    roomData.currentTurn = 0;
                }
            }
            io.to(room).emit('updateUsers', roomData.users);
            if (roomData.users.length === 0) {
                delete rooms[room];
                io.emit('roomList', Object.keys(rooms)); // 更新房间列表
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
