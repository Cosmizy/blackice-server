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

const WORLD_WIDTH = 1920;
const WORLD_HEIGHT = 1080;

const WALL_THICK = 28;

const SPIKE_DEPTH = 42;
const SPIKE_GAP = 16;

const CENTER_SPINNER_ARMS = 4;
const CENTER_SPINNER_INNER = 30;
const CENTER_SPINNER_OUTER = 150;
const CENTER_BLADE_HALF = 12;
const SPINNER_SPIKE_LENGTH = 42;
const SPINNER_SPIKE_WIDTH = 28;

const SPIN_SPEED = 1.7;

const ACCEL = 1000;
const MAX_SPEED = 900;
const FRICTION = 0.99;

const PLAYER_SIZE = 40;

const ATTACK_RANGE = 80;
const ATTACK_ARC = Math.PI / 1.8;
const ATTACK_COOLDOWN = 0.45;
const ATTACK_ACTIVE = 0.16;

const KNOCKBACK = 1600;

const COLORS = [
  "#111111", // black
  "#ff4444", // red
  "#4488ff", // blue
  "#44cc44", // green
  "#ffcc00", // yellow
  "#aa44ff", // purple
  "#00ccff", // cyan
  "#cc00ff", // magenta
  "#ff00cc", // pink

  // added extras
  "#ff7f50", // coral
  "#ff8c00", // dark orange
  "#1e90ff", // dodger blue
  "#32cd32", // lime green
  "#ffd700", // gold (brighter alternative yellow)
  "#8a2be2", // blue violet
  "#00fa9a", // medium spring green
  "#ff6347", // tomato
  "#20b2aa", // light sea green
  "#f08080", // light coral
];

const spikes = [];

regenSpikes();

const rooms = {
  room1: createRoom(),
  room2: createRoom(),
  room3: createRoom()
};

function pickUniqueColor(room) {
  const used = new Set();

  for (const id in room.players) {
    used.add(room.players[id].color);
  }

  const available = COLORS.filter(c => !used.has(c));

  // if all colors are taken, fallback to random (reuse allowed)
  if (available.length === 0) {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

function createRoom() {
  return {
    players: {},
    spinnerAngle: 0
  };
}

function regenSpikes() {
  spikes.length = 0;

  let x = WALL_THICK;

  while (x + SPIKE_GAP <= WORLD_WIDTH - WALL_THICK) {
    spikes.push(tri(
      x,
      WALL_THICK,
      x + SPIKE_GAP / 2,
      WALL_THICK + SPIKE_DEPTH,
      x + SPIKE_GAP,
      WALL_THICK
    ));

    spikes.push(tri(
      x,
      WORLD_HEIGHT - WALL_THICK,
      x + SPIKE_GAP / 2,
      WORLD_HEIGHT - WALL_THICK - SPIKE_DEPTH,
      x + SPIKE_GAP,
      WORLD_HEIGHT - WALL_THICK
    ));

    x += SPIKE_GAP;
  }

  let y = WALL_THICK;

  while (y + SPIKE_GAP <= WORLD_HEIGHT - WALL_THICK) {
    spikes.push(tri(
      WALL_THICK,
      y,
      WALL_THICK + SPIKE_DEPTH,
      y + SPIKE_GAP / 2,
      WALL_THICK,
      y + SPIKE_GAP
    ));

    spikes.push(tri(
      WORLD_WIDTH - WALL_THICK,
      y,
      WORLD_WIDTH - WALL_THICK - SPIKE_DEPTH,
      y + SPIKE_GAP / 2,
      WORLD_WIDTH - WALL_THICK,
      y + SPIKE_GAP
    ));

    y += SPIKE_GAP;
  }
}

function tri(x1, y1, x2, y2, x3, y3) {
  return {
    a: { x: x1, y: y1 },
    b: { x: x2, y: y2 },
    c: { x: x3, y: y3 },

    // NEW: rectangular hitbox (bounding box)
    hitbox: {
      x: Math.min(x1, x2, x3),
      y: Math.min(y1, y2, y3),
      w: Math.max(x1, x2, x3) - Math.min(x1, x2, x3),
      h: Math.max(y1, y2, y3) - Math.min(y1, y2, y3)
    }
  };
}

io.on("connection", socket => {
  const JOIN_COOLDOWN = 1500; // ms (1.5 seconds)
  socket.lastJoinTime = 0;
  
  socket.room = null;

  socket.on("joinRoom", roomName => {
  const now = Date.now();

  // cooldown check
  if (now - socket.lastJoinTime < JOIN_COOLDOWN) {
    return; // silently ignore spam
  }

  socket.lastJoinTime = now;

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
    id: socket.id,
    x: Math.random() * 1200 + 300,
    y: Math.random() * 600 + 200,
    vx: 0,
    vy: 0,
    ax: 0,
    ay: 0,
    facing: 0,
    size: PLAYER_SIZE,
    attackTimer: 0,
    attackActiveTimer: 0,
    alive: true,
    respawnTimer: 0,
    score: 0,
    input: {},
    color: pickUniqueColor(room)
  };
});

  socket.on("input", input => {

    const roomName = socket.room;

    if (!roomName) return;

    const room = rooms[roomName];

    const player = room.players[socket.id];

    if (!player) return;

    player.input = input;
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
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

  const dt = 1 / 60;

  for (const roomName in rooms) {

    const room = rooms[roomName];

    room.spinnerAngle += SPIN_SPEED * dt;

    const playerList = Object.values(room.players);

    for (const p of playerList) {

      if (!p.alive) {

        p.respawnTimer -= dt;

        if (p.respawnTimer <= 0) {
          respawnPlayer(p);
        }

        continue;
      }

      handleInput(p, dt);

      p.vx += p.ax * dt;
      p.vy += p.ay * dt;

      const speed = Math.hypot(p.vx, p.vy);

      if (speed > MAX_SPEED) {

        const scale = MAX_SPEED / speed;

        p.vx *= scale;
        p.vy *= scale;
      }

      p.vx *= FRICTION;
      p.vy *= FRICTION;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      keepInside(p);

      p.attackTimer = Math.max(0, p.attackTimer - dt);
      p.attackActiveTimer = Math.max(0, p.attackActiveTimer - dt);
    }

    for (let i = 0; i < playerList.length; i++) {
      for (let j = i + 1; j < playerList.length; j++) {
        resolvePlayerCollision(playerList[i], playerList[j]);
      }
    }

    resolveAttacks(playerList);

    for (const p of playerList) {

      if (!p.alive) continue;

      if (spikesKill(p) || spinnerKills(p, room.spinnerAngle)) {
        killPlayer(p);
      }
    }

    io.to(roomName).emit("state", {
      players: room.players,
      spinnerAngle: room.spinnerAngle
    });
  }
}

function handleInput(p, dt) {

  const input = p.input || {};

  p.ax = 0;
  p.ay = 0;

  let moved = false;

  if (input.left) {
    p.ax -= ACCEL;
    moved = true;
  }

  if (input.right) {
    p.ax += ACCEL;
    moved = true;
  }

  if (input.up) {
    p.ay -= ACCEL;
    moved = true;
  }

  if (input.down) {
    p.ay += ACCEL;
    moved = true;
  }

  if (moved) {
    p.facing = Math.atan2(p.ay, p.ax);
  }

  if (input.attack && p.attackTimer <= 0) {
    p.attackTimer = ATTACK_COOLDOWN;
    p.attackActiveTimer = ATTACK_ACTIVE;
  }
}

function keepInside(p) {

  const half = p.size / 2;

  const minX = WALL_THICK + half;
  const maxX = WORLD_WIDTH - WALL_THICK - half;

  const minY = WALL_THICK + half;
  const maxY = WORLD_HEIGHT - WALL_THICK - half;

  if (p.x < minX) {
    p.x = minX;
    p.vx = Math.abs(p.vx);
  }

  if (p.x > maxX) {
    p.x = maxX;
    p.vx = -Math.abs(p.vx);
  }

  if (p.y < minY) {
    p.y = minY;
    p.vy = Math.abs(p.vy);
  }

  if (p.y > maxY) {
    p.y = maxY;
    p.vy = -Math.abs(p.vy);
  }
}

function resolvePlayerCollision(p1, p2) {

  if (!p1.alive || !p2.alive) return;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const dist = Math.hypot(dx, dy);

  const minDist = p1.size;

  if (dist < minDist && dist > 0) {

    const nx = dx / dist;
    const ny = dy / dist;

    const overlap = (minDist - dist) / 2;

    p1.x -= nx * overlap;
    p1.y -= ny * overlap;

    p2.x += nx * overlap;
    p2.y += ny * overlap;

    const rvx = p2.vx - p1.vx;
    const rvy = p2.vy - p1.vy;

    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal < 0) {

      const restitution = 0.9;

      const impulse = -(1 + restitution) * velAlongNormal / 2;

      const ix = impulse * nx;
      const iy = impulse * ny;

      p1.vx -= ix;
      p1.vy -= iy;

      p2.vx += ix;
      p2.vy += iy;
    }
  }
}

function resolveAttacks(players) {

  for (const attacker of players) {

    if (!attacker.alive) continue;

    if (attacker.attackActiveTimer <= 0) continue;

    for (const defender of players) {

      if (attacker.id === defender.id) continue;

      if (!defender.alive) continue;

      const dx = defender.x - attacker.x;
      const dy = defender.y - attacker.y;

      const dist = Math.hypot(dx, dy);

      if (dist > ATTACK_RANGE + defender.size * 0.6) continue;

      const ang = Math.atan2(dy, dx);

      let delta = ang - attacker.facing;

      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;

      if (Math.abs(delta) <= ATTACK_ARC / 2) {

        const nx = Math.cos(attacker.facing);
        const ny = Math.sin(attacker.facing);

        defender.vx += nx * KNOCKBACK;
        defender.vy += ny * KNOCKBACK;

        attacker.attackActiveTimer = 0;
      }
    }
  }
}

function pointInTri(px, py, t){

  const {a,b,c} = t;

  const v0x = c.x - a.x;
  const v0y = c.y - a.y;

  const v1x = b.x - a.x;
  const v1y = b.y - a.y;

  const v2x = px - a.x;
  const v2y = py - a.y;

  const dot00 = v0x*v0x + v0y*v0y;
  const dot01 = v0x*v1x + v0y*v1y;
  const dot02 = v0x*v2x + v0y*v2y;
  const dot11 = v1x*v1x + v1y*v1y;
  const dot12 = v1x*v2x + v1y*v2y;

  const invDen = 1 / (dot00 * dot11 - dot01 * dot01 + 1e-9);

  const u = (dot11 * dot02 - dot01 * dot12) * invDen;
  const v = (dot00 * dot12 - dot01 * dot02) * invDen;

  return u >= 0 && v >= 0 && (u + v < 1);
}

function spikesKill(p){
  for (const t of spikes) {
    if (pointInTri(p.x, p.y, t)) {
      return true;
    }
  }
  return false;
}

function spinnerKills(p, spin){

  const dx = p.x - WORLD_WIDTH / 2;
  const dy = p.y - WORLD_HEIGHT / 2;

  const worldAngle = Math.atan2(dy, dx);

  const seg = (Math.PI * 2) / CENTER_SPINNER_ARMS;

  const armIndex = Math.round((worldAngle - spin) / seg);

  const armAngle = spin + armIndex * seg;

  const ca = Math.cos(-armAngle);
  const sa = Math.sin(-armAngle);

  const localX = dx * ca - dy * sa;
  const localY = dx * sa + dy * ca;

  const baseStart = CENTER_SPINNER_OUTER - SPINNER_SPIKE_WIDTH;
  const baseEnd = CENTER_SPINNER_OUTER;

  const tipX = (baseStart + baseEnd) / 2;
  const tipY = CENTER_BLADE_HALF + SPINNER_SPIKE_LENGTH;

  const r = p.size * 0.45;

  const tri = {
    a: {
      x: baseStart - r,
      y: CENTER_BLADE_HALF - r
    },

    b: {
      x: baseEnd + r,
      y: CENTER_BLADE_HALF - r
    },

    c: {
      x: tipX,
      y: tipY + r
    }
  };

  return pointInTri(localX, localY, tri);
}

function killPlayer(p){

  p.alive = false;

  p.respawnTimer = 2;
}

function respawnPlayer(p){

  p.alive = true;

  p.x = Math.random() * 1200 + 300;
  p.y = Math.random() * 600 + 200;

  p.vx = 0;
  p.vy = 0;
  p.color = pickUniqueColor(rooms[p.roomName]);
}

setInterval(updateRooms, 1000 / 60);

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
