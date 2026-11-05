// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 託管同目錄下的靜態檔案 (包含 index.html)
app.use(express.static(path.join(__dirname, '.')));

// 在記憶體中維護所有在線玩家資料
// 格式: { [socketId]: { id, name, gender, x, z, yaw, seatId } }
const players = {};

io.on('connection', (socket) => {
  console.log(`[+] 玩家連線: ${socket.id}`);

  // 1. 玩家加入影廳 (join_room)
  socket.on('join_room', (data) => {
    const playerData = {
      id: socket.id,
      name: data.name || '觀賽粉絲',
      gender: data.gender || 'm',
      x: data.x || 0,
      z: data.z || 7,
      yaw: data.yaw || 0,
      seatId: data.seatId !== undefined ? data.seatId : null
    };

    players[socket.id] = playerData;

    // 發送當前所有在線玩家清單給剛加入的新玩家
    socket.emit('current_players', players);

    // 廣播給其他玩家：有新玩家加入
    socket.broadcast.emit('player_joined', playerData);
    console.log(`[Join] ${playerData.name} (${socket.id}) 加入影廳`);
  });

  // 2. 玩家移動同步 (player_move)
  socket.on('player_move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].z = data.z;
      players[socket.id].yaw = data.yaw;
      players[socket.id].seatId = null; // 移動時自動重置座位狀態

      // 廣播給其他人該玩家新位置
      socket.broadcast.emit('player_moved', {
        id: socket.id,
        x: data.x,
        z: data.z,
        yaw: data.yaw
      });
    }
  });

  // 3. 玩家坐下 (player_sit)
  socket.on('player_sit', (data) => {
    if (players[socket.id]) {
      players[socket.id].seatId = data.seatId;
      if (data.x !== undefined && data.z !== undefined) {
        players[socket.id].x = data.x;
        players[socket.id].z = data.z;
      }

      socket.broadcast.emit('player_sat', {
        id: socket.id,
        seatId: data.seatId,
        x: data.x,
        z: data.z
      });
    }
  });

  // 4. 玩家起立 (player_stand)
  socket.on('player_stand', (data) => {
    if (players[socket.id]) {
      players[socket.id].seatId = null;
      if (data.x !== undefined && data.z !== undefined) {
        players[socket.id].x = data.x;
        players[socket.id].z = data.z;
      }

      socket.broadcast.emit('player_stood', {
        id: socket.id,
        x: data.x,
        z: data.z
      });
    }
  });

  // 5. 玩家頭頂氣泡與對話 (player_speak)
  socket.on('player_speak', (data) => {
    if (players[socket.id]) {
      socket.broadcast.emit('player_spoken', {
        id: socket.id,
        name: players[socket.id].name,
        msg: data.msg,
        kind: data.kind || 'chat',
        fx: data.fx || null
      });
    }
  });

  // 6. 玩家變更角色設定 (更新暱稱/性別)
  socket.on('update_profile', (data) => {
    if (players[socket.id]) {
      players[socket.id].name = data.name;
      players[socket.id].gender = data.gender;

      socket.broadcast.emit('profile_updated', {
        id: socket.id,
        name: data.name,
        gender: data.gender
      });
    }
  });

  // 7. 玩家離線 (disconnect)
  socket.on('disconnect', () => {
    if (players[socket.id]) {
      const pName = players[socket.id].name;
      delete players[socket.id];

      // 廣播給其他人該玩家已離線
      io.emit('player_left', { id: socket.id, name: pName });
      console.log(`[-] 玩家離線: ${pName} (${socket.id})`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Watch Party 伺服器已啟動：http://localhost:${PORT}`);
});