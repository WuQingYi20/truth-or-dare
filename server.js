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
    console.log('用户连接:', socket.id);

    // 创建或加入房间
    socket.on('joinRoom', ({ room, username }) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = { 
                users: [], 
                gameStarted: false, 
                playerOrder: [], 
                currentTurn: 0,
                pendingApproval: null,
                votingStatus: {
                    approvedCount: 0,
                    rejectedCount: 0,
                    voters: {},
                    totalRequired: 0
                }
            };
        }
        rooms[room].users.push({ id: socket.id, username });
        io.to(room).emit('updateUsers', rooms[room].users);
        console.log(`${username} 加入房间: ${room}`);

        // 广播房间列表
        io.emit('roomList', Object.keys(rooms));
    });

    // 开始游戏
    socket.on('startGame', ({ room }) => {
        const roomData = rooms[room];
        if (roomData && !roomData.gameStarted) {
            roomData.gameStarted = true;
            // 随机排列玩家顺序
            roomData.playerOrder = roomData.users.sort(() => Math.random() - 0.5);
            roomData.currentTurn = 0;
            io.to(room).emit('gameStarted', { playerOrder: roomData.playerOrder, currentTurn: roomData.currentTurn });
            console.log(`房间 ${room} 游戏开始`);
        }
    });

    // 处理选择真心话或大冒险
    socket.on('chooseAction', ({ room, action }) => {
        const roomData = rooms[room];
        if (roomData && roomData.gameStarted && !roomData.pendingApproval) {
            const currentPlayer = roomData.playerOrder[roomData.currentTurn];
            if (currentPlayer.id === socket.id) {
                let selected;
                if (action === 'truth') {
                    selected = truths[Math.floor(Math.random() * truths.length)];
                } else {
                    selected = dares[Math.floor(Math.random() * dares.length)];
                }
                
                // 初始化投票状态
                roomData.votingStatus = {
                    approvedCount: 0,
                    rejectedCount: 0,
                    voters: {},
                    totalRequired: Math.ceil((roomData.users.length - 1) / 2)
                };
                
                // 初始化审批状态
                roomData.pendingApproval = {
                    action,
                    selected,
                    username: currentPlayer.username
                };
                
                // 广播动作结果给所有玩家
                io.to(room).emit('actionResult', { 
                    action, 
                    selected, 
                    username: currentPlayer.username 
                });
            }
        }
    });
    
    // 处理玩家的批准或通过
    // 在 server.js 中修改投票处理逻辑
    socket.on('approveAnswer', ({ room, approval }) => {
        const roomData = rooms[room];
        if (roomData && roomData.votingStatus) {
            // 记录投票
            const voter = roomData.users.find(u => u.id === socket.id);
            if (!voter) return;

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
            const requiredVotes = Math.ceil(totalVoters / 2);
            
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
                    // 重置所有状态
                    roomData.votingStatus = {
                        approvedCount: 0,
                        rejectedCount: 0,
                        voters: {},
                        totalRequired: Math.ceil((roomData.users.length - 1) / 2)
                    };
                    roomData.pendingApproval = null; // 重要：重置 pendingApproval
                    io.to(room).emit('nextTurn', { currentTurn: roomData.currentTurn });
                }else {
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

    // 断开连接
    socket.on('disconnect', () => {
        console.log('用户开连接:', socket.id);
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
            // 如果房间空了，删除房间
            if (roomData.users.length === 0) {
                delete rooms[room];
                io.emit('roomList', Object.keys(rooms)); // 更新房间列表
            }
        }
    });

    // 处理获取房间列表
    socket.on('getRooms', () => {
        socket.emit('roomList', Object.keys(rooms));
    });
});

http.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
