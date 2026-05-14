<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Black Ice Multiplayer</title>

<style>

html,body{
margin:0;
overflow:hidden;
background:#e9f5ff;
}

canvas{
display:block;
width:100vw;
height:100vh;
background:radial-gradient(
1200px 800px at center,
#f7fbff 0%,
#e9f5ff 55%,
#dff0ff 100%
);
}

#menu{
position:fixed;
top:20px;
left:20px;
z-index:100;
}

button{
padding:10px 18px;
margin-right:10px;
border:none;
border-radius:10px;
cursor:pointer;
font-size:16px;
}

#status{
position:fixed;
top:20px;
right:20px;
background:white;
padding:10px;
border-radius:10px;
font-family:sans-serif;
}

</style>
</head>
<body>

<div id="menu">
<button onclick="joinRoom('room1')">Room 1</button>
<button onclick="joinRoom('room2')">Room 2</button>
<button onclick="joinRoom('room3')">Room 3</button>
</div>

<div id="status">Disconnected</div>

<canvas id="game"></canvas>

<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>

<script>

const SERVER_URL = "YOUR_RENDER_URL";

const socket = io(SERVER_URL);

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");

let W = window.innerWidth;
let H = window.innerHeight;

canvas.width = W;
canvas.height = H;

window.addEventListener("resize", () => {

W = window.innerWidth;
H = window.innerHeight;

canvas.width = W;
canvas.height = H;

});

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

const ATTACK_RANGE = 54;
const ATTACK_ARC = Math.PI / 2.2;

let myId = null;

let currentRoom = null;

let spinnerAngle = 0;

let players = {};

const keys = {};

const spikes = [];

regenSpikes();

window.addEventListener("keydown", e => {

keys[e.code] = true;

if([
"ArrowUp",
"ArrowDown",
"ArrowLeft",
"ArrowRight",
"Space"
].includes(e.code)){
e.preventDefault();
}

});

window.addEventListener("keyup", e => {
keys[e.code] = false;
});

function joinRoom(room){

currentRoom = room;

socket.emit("joinRoom", room);

}

socket.on("connect", () => {

myId = socket.id;

statusEl.innerText = "Connected";

});

socket.on("disconnect", () => {

statusEl.innerText = "Disconnected";

});

socket.on("roomFull", () => {
alert("Room full");
});

socket.on("state", state => {

players = state.players;

spinnerAngle = state.spinnerAngle;

});

function updateInput(){

if(!currentRoom) return;

socket.emit("input",{

up: keys["KeyW"] || keys["ArrowUp"],
down: keys["KeyS"] || keys["ArrowDown"],
left: keys["KeyA"] || keys["ArrowLeft"],
right: keys["KeyD"] || keys["ArrowRight"],

attack: keys["Space"]

});

}

setInterval(updateInput,1000/60);

function worldToScreen(x,y){

const sx = (x / WORLD_WIDTH) * W;
const sy = (y / WORLD_HEIGHT) * H;

return {x:sx,y:sy};

}

function regenSpikes(){

spikes.length = 0;

let x = WALL_THICK;

while(x + SPIKE_GAP <= WORLD_WIDTH - WALL_THICK){

spikes.push(tri(
x,
WALL_THICK,
x + SPIKE_GAP/2,
WALL_THICK + SPIKE_DEPTH,
x + SPIKE_GAP,
WALL_THICK
));

spikes.push(tri(
x,
WORLD_HEIGHT - WALL_THICK,
x + SPIKE_GAP/2,
WORLD_HEIGHT - WALL_THICK - SPIKE_DEPTH,
x + SPIKE_GAP,
WORLD_HEIGHT - WALL_THICK
));

x += SPIKE_GAP;
}

let y = WALL_THICK;

while(y + SPIKE_GAP <= WORLD_HEIGHT - WALL_THICK){

spikes.push(tri(
WALL_THICK,
y,
WALL_THICK + SPIKE_DEPTH,
y + SPIKE_GAP/2,
WALL_THICK,
y + SPIKE_GAP
));

spikes.push(tri(
WORLD_WIDTH - WALL_THICK,
y,
WORLD_WIDTH - WALL_THICK - SPIKE_DEPTH,
y + SPIKE_GAP/2,
WORLD_WIDTH - WALL_THICK,
y + SPIKE_GAP
));

y += SPIKE_GAP;
}
}

function tri(x1,y1,x2,y2,x3,y3){

return{
a:{x:x1,y:y1},
b:{x:x2,y:y2},
c:{x:x3,y:y3}
};

}

function drawWalls(){

ctx.fillStyle = "#0b0b0b";

const tX = (WALL_THICK / WORLD_WIDTH) * W;
const tY = (WALL_THICK / WORLD_HEIGHT) * H;

ctx.fillRect(0,0,W,tY);
ctx.fillRect(0,H-tY,W,tY);

ctx.fillRect(0,0,tX,H);
ctx.fillRect(W-tX,0,tX,H);

}

function drawSpikes(){

ctx.fillStyle = "#0b0b0b";

for(const t of spikes){

const a = worldToScreen(t.a.x,t.a.y);
const b = worldToScreen(t.b.x,t.b.y);
const c = worldToScreen(t.c.x,t.c.y);

ctx.beginPath();

ctx.moveTo(a.x,a.y);
ctx.lineTo(b.x,b.y);
ctx.lineTo(c.x,c.y);

ctx.closePath();

ctx.fill();
}
}

function drawSpinner(){

const center = worldToScreen(
WORLD_WIDTH/2,
WORLD_HEIGHT/2
);

ctx.save();

ctx.translate(center.x,center.y);

ctx.rotate(spinnerAngle);

ctx.fillStyle = "#0b0b0b";

for(let i=0;i<CENTER_SPINNER_ARMS;i++){

ctx.rotate((Math.PI*2)/CENTER_SPINNER_ARMS);

const inner =
(CENTER_SPINNER_INNER / WORLD_WIDTH) * W;

const outer =
(CENTER_SPINNER_OUTER / WORLD_WIDTH) * W;

const half =
(CENTER_BLADE_HALF / WORLD_HEIGHT) * H;

ctx.beginPath();

ctx.moveTo(inner,-half);
ctx.lineTo(outer,-half);
ctx.lineTo(outer,half);
ctx.lineTo(inner,half);

ctx.closePath();

ctx.fill();

const spikeWidth =
(SPINNER_SPIKE_WIDTH / WORLD_WIDTH) * W;

const spikeLength =
(SPINNER_SPIKE_LENGTH / WORLD_HEIGHT) * H;

const baseStart = outer - spikeWidth;
const baseEnd = outer;

ctx.beginPath();

ctx.moveTo(baseStart,half);
ctx.lineTo(baseEnd,half);
ctx.lineTo(
(baseStart+baseEnd)/2,
half + spikeLength
);

ctx.closePath();

ctx.fill();
}

ctx.beginPath();

ctx.arc(0,0,10,0,Math.PI*2);

ctx.fill();

ctx.restore();

}

function drawPlayers(){

for(const id in players){

const p = players[id];

if(!p.alive) continue;

const pos = worldToScreen(p.x,p.y);

const size = (p.size / WORLD_WIDTH) * W;

ctx.save();

ctx.globalAlpha = 0.12;

ctx.fillStyle = "#000";

ctx.fillRect(
pos.x - size/2 + 3,
pos.y - size/2 + 5,
size,
size
);

ctx.globalAlpha = 1;

ctx.fillStyle = p.color;

ctx.fillRect(
pos.x - size/2,
pos.y - size/2,
size,
size
);

const nx = Math.cos(p.facing);
const ny = Math.sin(p.facing);

ctx.fillStyle = "white";

ctx.fillRect(
pos.x + nx*(size/2) - 2,
pos.y + ny*(size/2) - 2,
4,
4
);

if(p.attackActiveTimer > 0){

ctx.save();

ctx.translate(pos.x,pos.y);

ctx.rotate(p.facing);

ctx.globalAlpha = 0.2;

ctx.beginPath();

ctx.moveTo(0,0);

ctx.arc(
0,
0,
(ATTACK_RANGE / WORLD_WIDTH) * W,
-ATTACK_ARC/2,
ATTACK_ARC/2
);

ctx.closePath();

ctx.fill();

ctx.restore();
}

if(id === myId){

ctx.strokeStyle = "white";

ctx.lineWidth = 3;

ctx.strokeRect(
pos.x - size/2 - 3,
pos.y - size/2 - 3,
size + 6,
size + 6
);
}

ctx.restore();
}
}

function drawIceSheen(){

const t = performance.now() * 0.001;

for(let i=0;i<3;i++){

const y = (H/3)*i + ((t*40+i*80)%(H/3));

const grad = ctx.createLinearGradient(
0,y,W,y+80
);

grad.addColorStop(0,"rgba(255,255,255,0)");
grad.addColorStop(0.5,"rgba(255,255,255,0.08)");
grad.addColorStop(1,"rgba(255,255,255,0)");

ctx.fillStyle = grad;

ctx.fillRect(0,y,W,80);
}
}

function render(){

ctx.clearRect(0,0,W,H);

drawIceSheen();

drawWalls();

drawSpikes();

drawSpinner();

drawPlayers();

requestAnimationFrame(render);

}

render();

</script>
</body>
</html>
