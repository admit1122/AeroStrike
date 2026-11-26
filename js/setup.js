// Canvas setup, cosmetics (skins/trails/colors), hangar state

const canvas = document.getElementById("canvas"); const ctx = canvas.getContext("2d");
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resize); resize();

const SKINS = [
  { id: 'raptor', name: 'F-22 Raptor', price: 0, minLevel: 1, draw: (c) => { c.moveTo(22, 0); c.lineTo(4, -6); c.lineTo(-8, -16); c.lineTo(-14, -16); c.lineTo(-8, -4); c.lineTo(-18, -6); c.lineTo(-20, 0); c.lineTo(-18, 6); c.lineTo(-8, 4); c.lineTo(-14, 16); c.lineTo(-8, 16); c.lineTo(4, 6); c.closePath(); } },
  { id: 'interceptor', name: 'F-16 Interceptor', price: 250, minLevel: 1, draw: (c) => { c.moveTo(20, 0); c.lineTo(0, -6); c.lineTo(-12, -14); c.lineTo(-14, -14); c.lineTo(-8, -4); c.lineTo(-18, -4); c.lineTo(-22, 0); c.lineTo(-18, 4); c.lineTo(-8, 4); c.lineTo(-14, 14); c.lineTo(-12, 14); c.lineTo(0, 6); c.closePath(); } },
  { id: 'stealth', name: 'B-2 Ghost', price: 500, minLevel: 1, draw: (c) => { c.moveTo(14, 0); c.lineTo(-8, -22); c.lineTo(-16, -16); c.lineTo(-8, -8); c.lineTo(-14, 0); c.lineTo(-8, 8); c.lineTo(-16, 16); c.lineTo(-8, 22); c.closePath(); } },
  { id: 'crimson', name: 'X-Wyvern', price: 1200, minLevel: 1, draw: (c) => { c.moveTo(24, 0); c.lineTo(10, -4); c.lineTo(18, -14); c.lineTo(8, -14); c.lineTo(-6, -6); c.lineTo(-16, -10); c.lineTo(-16, -4); c.lineTo(-22, 0); c.lineTo(-16, 4); c.lineTo(-16, 10); c.lineTo(-6, 6); c.lineTo(8, 14); c.lineTo(18, 14); c.lineTo(10, 4); c.closePath(); } },
  { id: 'vulcan', name: 'Vulcan V', price: 1800, minLevel: 1, draw: (c) => { c.moveTo(18, -6); c.lineTo(18, 6); c.lineTo(8, 6); c.lineTo(0, 18); c.lineTo(-10, 18); c.lineTo(-4, 4); c.lineTo(-18, 4); c.lineTo(-24, 8); c.lineTo(-24, -8); c.lineTo(-18, -4); c.lineTo(-4, -4); c.lineTo(-10, -18); c.lineTo(0, -18); c.lineTo(8, -6); c.closePath(); } },
  { id: 'titan', name: 'A-10 Titan', price: 2500, minLevel: 1, draw: (c) => { c.moveTo(18, 0); c.lineTo(10, -5); c.lineTo(4, -5); c.lineTo(2, -22); c.lineTo(-4, -22); c.lineTo(-6, -5); c.lineTo(-18, -4); c.lineTo(-18, -10); c.lineTo(-22, -10); c.lineTo(-22, 10); c.lineTo(-18, 10); c.lineTo(-18, 4); c.lineTo(-6, 5); c.lineTo(-4, 22); c.lineTo(2, 22); c.lineTo(4, 5); c.lineTo(10, 5); c.closePath(); } },
  { id: 'phantom', name: 'F-14 Phantom', price: 4000, minLevel: 1, draw: (c) => { c.moveTo(26, 0); c.lineTo(8, -3); c.lineTo(-8, -20); c.lineTo(-16, -20); c.lineTo(-12, -4); c.lineTo(-24, -6); c.lineTo(-24, 6); c.lineTo(-12, 4); c.lineTo(-16, 20); c.lineTo(-8, 20); c.lineTo(8, 3); c.closePath(); } },
  { id: 'berkut', name: 'Su-47 Berkut', price: 6500, minLevel: 5, draw: (c) => { c.moveTo(26, 0); c.lineTo(4, -4); c.lineTo(12, -20); c.lineTo(6, -20); c.lineTo(-10, -6); c.lineTo(-20, -6); c.lineTo(-24, 0); c.lineTo(-20, 6); c.lineTo(-10, 6); c.lineTo(6, 20); c.lineTo(12, 20); c.lineTo(4, 4); c.closePath(); } },
  { id: 'drone', name: 'X-99 Drone', price: 10000, minLevel: 10, draw: (c) => { c.moveTo(16, 0); c.lineTo(-4, -18); c.lineTo(-14, -18); c.lineTo(-8, -10); c.lineTo(-8, 10); c.lineTo(-14, 18); c.lineTo(-4, 18); c.closePath(); } },
  { id: 'alien', name: 'Zeta Saucer', price: 15000, minLevel: 1, draw: (c) => { c.moveTo(20, 0); c.lineTo(12, -12); c.lineTo(2, -18); c.lineTo(-10, -18); c.lineTo(-20, -8); c.lineTo(-14, 0); c.lineTo(-20, 8); c.lineTo(-10, 18); c.lineTo(2, 18); c.lineTo(12, 12); c.closePath(); } }
];

const TRAILS = [
  { id: 'smoke', name: 'Basic Smoke', price: 0, color: '#94a3b8', shape: 'circle' },
  { id: 'fire', name: 'Afterburner', price: 100, color: '#f59e0b', shape: 'circle' },
  { id: 'azure', name: 'Azure Drive', price: 250, color: '#38bdf8', shape: 'circle' },
  { id: 'slime', name: 'Toxic Sludge', price: 400, color: '#84cc16', shape: 'circle' },
  { id: 'blood', name: 'Crimson Wake', price: 600, color: '#ef4444', shape: 'circle' },
  { id: 'snow', name: 'Blizzard', price: 800, color: '#ffffff', shape: 'circle' },
  { id: 'midas', name: 'Midas Sparkle', price: 1200, color: '#fbbf24', shape: 'star' },
  { id: 'pink', name: 'Pink Mist', price: 1800, color: '#ec4899', shape: 'circle' },
  { id: 'matrix', name: 'Cyber Stream', price: 2500, color: '#22c55e', shape: 'square' },
  { id: 'void', name: 'Dark Matter', price: 4000, color: '#1e1b4b', shape: 'square' },
  { id: 'rainbow', name: 'Rainbow Blast', price: 7000, color: 'rainbow', shape: 'circle' },
  { id: 'royal', name: 'Royal Majesty', price: 10000, color: '#a855f7', shape: 'star' }
];

const COLORS = ['#0ea5e9', '#64748b', '#ef4444', '#fbbf24', '#10b981', '#a855f7', '#ec4899', '#84cc16', '#ffffff', '#14b8a6', '#f43f5e', '#8b5cf6', '#d946ef', '#0ea5e9'];
const CRATE_COLORS = { "MISSILE": "#ef4444", "SHOTGUN": "#38bdf8", "LASER": "#a855f7", "SHIELD": "#22c55e", "PLASMA": "#facc15", "FLAK": "#f97316", "MINES": "#d946ef" };

let viewingSkin = SKINS.find(s => s.id === userProfile.activeSkin) || SKINS[0];
let viewingTrail = TRAILS.find(t => t.id === userProfile.activeTrail) || TRAILS[0];
let revengeTarget = null; 
let killAnnounceTimeout;

let isInHangar = true;
let savedMatchKills = 0;
let savedLifeKills = 0;
let savedCurrentStreak = 0;
let savedMaxStreak = 0;
let savedLifeTimer = 0;
let savedWeapon = "CANNON";
let savedAmmo = Infinity;
let savedHp = 100;
let savedBoost = 100;
let savedPosX = null;
let savedPosY = null;
let savedAngle = 0;
let hasLeftMatchOnce = false;
