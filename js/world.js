// World size, maps, environment, mouse/keyboard input

const WORLD_WIDTH = 5500; const WORLD_HEIGHT = 2600; const seaLevel = WORLD_HEIGHT - 250;
const MAPS = [
  { id: 'sunset', name: "Sunset Isles", skyTop: "#082f49", skyBot: "#c2410c", sea: "#0369a1", env: 'clouds' },
  { id: 'matrix', name: "Neon Matrix", skyTop: "#020617", skyBot: "#1e1b4b", sea: "#065f46", env: 'cyber' },
  { id: 'inferno', name: "Inferno Canyon", skyTop: "#2a0800", skyBot: "#7f1d1d", sea: "#dc2626", env: 'lava' },
  { id: 'glacial', name: "Glacial Peaks", skyTop: "#0f172a", skyBot: "#0284c7", sea: "#bae6fd", env: 'snow' },
  { id: 'toxic', name: "Toxic Wasteland", skyTop: "#064e3b", skyBot: "#4d7c0f", sea: "#14532d", env: 'acid' },
  { id: 'cosmic', name: "Cosmic Void", skyTop: "#09090b", skyBot: "#3b0764", sea: "#000000", env: 'stars' }
];

let currentMapIdx = 0; let roundTimer = 120; let isRoundActive = false; let isVoting = false; let voteTimer = 15;
let mapVotes = []; let playerMapVote = -1;
let envObjects = []; let bullets = []; let missiles = []; let crates = []; let mines = []; let particles = []; let floatTexts = [];

function initEnvironment() {
  envObjects = []; 
  let safeMapIdx = currentMapIdx >= 0 && currentMapIdx < MAPS.length ? currentMapIdx : 0;
  const mapType = MAPS[safeMapIdx].env;

  if (mapType === 'clouds') {
    for(let i=0; i<100; i++) envObjects.push({ type:'cloud', x: Math.random()*WORLD_WIDTH, y: Math.random()*(seaLevel-300), r: 50+Math.random()*180, speed: 0.2+Math.random()*0.8, alpha: 0.02+Math.random()*0.06 });
    for(let i=0; i<15; i++) envObjects.push({ type:'bird', x: Math.random()*WORLD_WIDTH, y: 100+Math.random()*500, speed: 1+Math.random()*2 });
  } else if (mapType === 'cyber') {
    for(let i=0; i<150; i++) envObjects.push({ type:'data', x: Math.random()*WORLD_WIDTH, y: Math.random()*seaLevel, speed: 2+Math.random()*6, len: 40+Math.random()*100 });
    for(let i=0; i<40; i++) envObjects.push({ type:'cube', x: Math.random()*WORLD_WIDTH, y: Math.random()*seaLevel, size: 30+Math.random()*60, rot: Math.random()*Math.PI });
  } else if (mapType === 'lava') {
    for(let i=0; i<12; i++) envObjects.push({ type:'volcano', x: Math.random()*WORLD_WIDTH, y: seaLevel, w: 800+Math.random()*1200, h: 400+Math.random()*800 });
    for(let i=0; i<400; i++) envObjects.push({ type:'ember', x: Math.random()*WORLD_WIDTH, y: seaLevel, speed: -(1+Math.random()*8), life: Math.random() });
    for(let i=0; i<60; i++) envObjects.push({ type:'rock', x: Math.random()*WORLD_WIDTH, w: 60+Math.random()*200, h: 40+Math.random()*200 });
  } else if (mapType === 'snow') {
    for(let i=0; i<30; i++) envObjects.push({ type:'iceberg', x: Math.random()*WORLD_WIDTH, y: seaLevel, w: 300+Math.random()*800, h: 200+Math.random()*500 });
    for(let i=0; i<600; i++) envObjects.push({ type:'flake', x: Math.random()*WORLD_WIDTH, y: Math.random()*seaLevel, speedX: 4+Math.random()*10, speedY: 1+Math.random()*5, size: 1+Math.random()*4 });
  } else if (mapType === 'acid') {
    for(let i=0; i<60; i++) envObjects.push({ type:'gas', x: Math.random()*WORLD_WIDTH, y: Math.random()*seaLevel, r: 200+Math.random()*400, alpha: 0.05+Math.random()*0.1 });
    for(let i=0; i<300; i++) envObjects.push({ type:'rain', x: Math.random()*WORLD_WIDTH, y: Math.random()*seaLevel, speed: 8+Math.random()*8 });
    for(let i=0; i<40; i++) envObjects.push({ type:'barrel', x: Math.random()*WORLD_WIDTH, y: seaLevel-15, rot: Math.random() });
  } else if (mapType === 'stars') {
    for(let i=0; i<8; i++) envObjects.push({ type:'nebula', x: Math.random()*WORLD_WIDTH, y: Math.random()*seaLevel, r: 600+Math.random()*1500, hue: Math.random()*360 });
    for(let i=0; i<600; i++) envObjects.push({ type:'star', x: Math.random()*WORLD_WIDTH, y: Math.random()*seaLevel, size: Math.random()*3, alpha: Math.random() });
    for(let i=0; i<6; i++) envObjects.push({ type:'planet', x: Math.random()*WORLD_WIDTH, y: 100+Math.random()*700, r: 100+Math.random()*400, hue: Math.random()*360 });
  }
}

const mouse = { x: canvas.width/2, y: canvas.height/2, down: false }; const keys = { space: false };
window.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener("mousedown", e => { if (e.button === 0 && !isInHangar) mouse.down = true; });
window.addEventListener("mouseup", e => { if (e.button === 0) mouse.down = false; });
window.addEventListener("keydown", e => { if (e.code === "Space") keys.space = true; });
window.addEventListener("keyup", e => { if (e.code === "Space") keys.space = false; });
