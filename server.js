const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

const MAX_PLAYERS = 6;

const rooms = {
  room1: createRoom(),
  room2: createRoom(),
  room3: createRoom()
};

function createRoom() {
  return {
    players: {},
    spinnerAngle: 0
  };
}

const COLORS = [
  "#111111",
  "#ff4444",
  "#4488ff",
  "#44cc44",
  "#ffcc00",
  "#aa44ff"
];

io.on("connection", socket => {
  console.log("Player connected", socket.id);

  socket.room = null;

  socket.on("joinRoom", roomName => {
    const room = rooms[roomName];

    if (!room) return;

    const count = Object.keys(room.players).length;

    if (count >= MAX_PLAYERS) {
      socket.emit("roomFull");
      return;
    }

    if (socket.room) {
      leaveRoom(socket);
    }

    socket.join(roomName);
    socket.room = roomName;

    room.players[socket.id] = {
      x: Math.random() * 800 + 100,
      y: Math.random() * 500 + 100,
      vx: 0,
      vy: 0,
      color: COLORS[count % COLORS.length]
    };
  });

  socket.on("input", input => {
    const roomName = socket.room;

    if (!roomName) return;

    const room = rooms[roomName];
    const player = room.players[socket.id];

    if (!player) return;

    const speed = 6;

    if (input.left) player.vx -= speed;
    if (input.right) player.vx += speed;
    if (input.up) player.vy -= speed;
    if (input.down) player.vy += speed;
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
    console.log("Player disconnected", socket.id);
  });
});

function leaveRoom(socket) {
  const roomName = socket.room;

  if (!roomName) return;

  const room = rooms[roomName];

  delete room.players[socket.id];

  socket.leave(roomName);
}

function updateRooms() {
  for (const roomName in rooms) {
    const room = rooms[roomName];

    room.spinnerAngle += 0.02;

    for (const id in room.players) {
      const p = room.players[id];

      p.x += p.vx;
      p.y += p.vy;

      p.vx *= 0.94;
      p.vy *= 0.94;

      if (p.x < 20) p.x = 20;
      if (p.x > 1900) p.x = 1900;
      if (p.y < 20) p.y = 20;
      if (p.y > 1000) p.y = 1000;
    }

    io.to(roomName).emit("state", {
      players: room.players,
      spinnerAngle: room.spinnerAngle
    });
  }
}

setInterval(updateRooms, 1000 / 60);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});