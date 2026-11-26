// Player profile: save/load, quests, daily login bonus, XP + levels, badge tiers

// Game State & Storage
let userProfile = { 
  name: "Pilot", activeSkin: 'raptor', activeColor: '#0ea5e9', activeTrail: 'smoke',
  ownedSkins: ['raptor'], ownedColors: ['#0ea5e9'], ownedTrails: ['smoke'], 
  coins: 2000, xp: 0, level: 1, careerKills: 0, careerWins: 0, highestStreak: 0,
  musicVol: 50, sfxVol: 80, botDifficulty: 1, botPersonalities: true, equippedBadge: null,
  lastLoginDate: "", loginStreak: 0, streakClaimedToday: false,
  stats: { totalGames: 0, distanceFlown: 0, missileKills: 0 },
  claimedQuests: []
};

try { 
  const saved = JSON.parse(localStorage.getItem("aerostrike_ffa_v80")); 
  if (saved) { 
    Object.assign(userProfile, saved); 
    if (!Array.isArray(userProfile.ownedColors)) userProfile.ownedColors = ['#0ea5e9']; 
    if (!Array.isArray(userProfile.ownedSkins)) userProfile.ownedSkins = ['raptor']; 
    if (!Array.isArray(userProfile.ownedTrails)) userProfile.ownedTrails = ['smoke']; 
    if (!userProfile.stats) userProfile.stats = { totalGames: 0, distanceFlown: 0, missileKills: 0 };
    if (!Array.isArray(userProfile.claimedQuests)) userProfile.claimedQuests = [];
    if (userProfile.xp === undefined) userProfile.xp = 0;
    if (userProfile.level === undefined) userProfile.level = 1;
    if (userProfile.musicVol === undefined) userProfile.musicVol = 50;
    if (userProfile.sfxVol === undefined) userProfile.sfxVol = 80;
    if (userProfile.botDifficulty === undefined) userProfile.botDifficulty = 1;
    if (userProfile.botPersonalities === undefined) userProfile.botPersonalities = true;
    if (userProfile.careerWins === undefined) userProfile.careerWins = 0;
    if (userProfile.highestStreak === undefined) userProfile.highestStreak = 0;
    if (userProfile.loginStreak === undefined) userProfile.loginStreak = 0;
  } 
} catch(e){}

function saveProfile() { try { localStorage.setItem("aerostrike_ffa_v80", JSON.stringify(userProfile)); } catch(e){} }

const QUESTS = [
  { id: 'games_5', title: 'Sortie Novice', desc: 'Complete 5 matches', target: 5, reward: 250, key: 'totalGames' },
  { id: 'games_20', title: 'Ace Pilot', desc: 'Complete 20 matches', target: 20, reward: 1000, key: 'totalGames' },
  { id: 'dist_1000', title: 'Frequent Flyer', desc: 'Fly a total distance of 1,000 units', target: 1000, reward: 500, key: 'distanceFlown' },
  { id: 'dist_10000', title: 'Globetrotter', desc: 'Fly a total distance of 10,000 units', target: 10000, reward: 2500, key: 'distanceFlown' },
  { id: 'msl_5', title: 'Rocket Man', desc: 'Get 5 missile eliminations', target: 5, reward: 400, key: 'missileKills' },
  { id: 'msl_25', title: 'Death From Above', desc: 'Get 25 missile eliminations', target: 25, reward: 2000, key: 'missileKills' }
];

function openQuests() {
  document.getElementById("menu-modal").style.display = "none";
  document.getElementById("quests-modal").style.display = "flex";
  renderQuests();
}

function openHelp() {
  document.getElementById("menu-modal").style.display = "none";
  document.getElementById("help-modal").style.display = "flex";
}

function renderQuests() {
  const container = document.getElementById("quests-container");
  container.innerHTML = "";

  QUESTS.forEach(q => {
    let currentVal = userProfile.stats[q.key] || 0;
    let isCompleted = currentVal >= q.target;
    let isClaimed = userProfile.claimedQuests.includes(q.id);
    let pct = Math.min(100, (currentVal / q.target) * 100);

    let div = document.createElement("div");
    div.className = `quest-card ${isCompleted && !isClaimed ? 'completed' : ''}`;
    
    let btnHtml = "";
    if (isClaimed) {
      btnHtml = `<span style="color:#22c55e; font-size:12px; font-weight:bold;">CLAIMED</span>`;
    } else if (isCompleted) {
      btnHtml = `<button class="btn buy" style="padding:6px 14px; font-size:12px; flex:none;" onclick="claimQuest('${q.id}', ${q.reward})">CLAIM</button>`;
    } else {
      btnHtml = `<span style="color:#94a3b8; font-size:12px; font-family:monospace;">${currentVal} / ${q.target}</span>`;
    }

    div.innerHTML = `
      <div style="flex:1; padding-right:15px;">
        <div style="font-weight:900; font-size:14px; color:#fff;">${q.title}</div>
        <div style="font-size:12px; color:#94a3b8; margin-top:2px;">${q.desc}</div>
        <div class="quest-progress-bg"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
        <div style="color:#fbbf24; font-weight:bold; font-size:13px;">+${q.reward} 🪙</div>
        ${btnHtml}
      </div>
    `;
    container.appendChild(div);
  });
}

function claimQuest(id, reward) {
  if (userProfile.claimedQuests.includes(id)) return;
  userProfile.claimedQuests.push(id);
  userProfile.coins += reward;
  saveProfile();
  renderQuests();
  floatTexts.push({ x: canvas.width/2, y: canvas.height/2, text: `+${reward} 🪙 QUEST COMPLETED!`, life: 3.0 });
}

// Daily Login Streak Check
function checkDailyLogin() {
  const todayStr = new Date().toDateString();
  if (userProfile.lastLoginDate !== todayStr) {
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (userProfile.lastLoginDate === yesterday.toDateString()) {
      userProfile.loginStreak = Math.min(5, userProfile.loginStreak + 1);
    } else {
      userProfile.loginStreak = 1; 
    }
    userProfile.streakClaimedToday = false;
    userProfile.lastLoginDate = todayStr;
    saveProfile();
  }

  if (!userProfile.streakClaimedToday) {
    showDailyBonusModal();
  }
}

const STREAK_REWARDS = [
  { day: 1, coins: 100 },
  { day: 2, coins: 250 },
  { day: 3, coins: 500 },
  { day: 4, coins: 1000 },
  { day: 5, coins: 2000 }
];

function showDailyBonusModal() {
  const grid = document.getElementById("streak-grid-container");
  grid.innerHTML = "";
  
  STREAK_REWARDS.forEach(r => {
    let isCurrent = (r.day === userProfile.loginStreak);
    let isPast = (r.day < userProfile.loginStreak || (r.day === userProfile.loginStreak && userProfile.streakClaimedToday));
    
    let card = document.createElement("div");
    card.className = `streak-card ${isPast ? 'claimed' : ''} ${isCurrent && !userProfile.streakClaimedToday ? 'active-day' : ''}`;
    card.innerHTML = `
      <div style="font-size:11px; font-weight:bold; color:#94a3b8; margin-bottom:4px;">DAY ${r.day}</div>
      <div style="font-size:24px; margin-bottom:4px;">🎁</div>
      <div style="font-size:13px; font-weight:900; color:#fbbf24;">+${r.coins} 🪙</div>
    `;
    grid.appendChild(card);
  });

  document.getElementById("menu-modal").style.display = "none";
  document.getElementById("daily-bonus-modal").style.display = "flex";
}

function claimDailyBonus() {
  if (userProfile.streakClaimedToday) return;
  let reward = STREAK_REWARDS[Math.min(4, userProfile.loginStreak - 1)].coins;
  userProfile.coins += reward;
  userProfile.streakClaimedToday = true;
  saveProfile();
  
  floatTexts.push({ x: canvas.width/2, y: canvas.height/2, text: `+${reward} 🪙 DAILY BONUS!`, life: 3.0 });
  document.getElementById("daily-bonus-modal").style.display = "none";
  document.getElementById("menu-modal").style.display = "flex";
  buildStore();
}

function getRequiredXP(lvl) {
  return lvl * 500;
}

function addXP(amount) {
  userProfile.xp += amount;
  let req = getRequiredXP(userProfile.level);
  while (userProfile.xp >= req) {
    userProfile.xp -= req;
    userProfile.level++;
    req = getRequiredXP(userProfile.level);
    floatTexts.push({ x: player.x, y: player.y - 40, text: `LEVEL UP! LVL ${userProfile.level}`, life: 3.0 });
  }
  saveProfile();
  updateTopBarXP();
}

function updateTopBarXP() {
  let req = getRequiredXP(userProfile.level);
  let pct = Math.min(100, (userProfile.xp / req) * 100);
  document.getElementById("level-txt").innerText = `LVL ${userProfile.level}`;
  document.getElementById("xp-txt").innerText = `${userProfile.xp} / ${req} XP`;
  document.getElementById("xp-bar-fill").style.width = `${pct}%`;
}

const BADGE_TIERS = [
  { req: 1, name: "Wood", color: "#8B5A2B", icon: "🪵", type: 'kills' },
  { req: 5, name: "Bronze", color: "#CD7F32", icon: "🥉", type: 'kills' },
  { req: 10, name: "Silver", color: "#C0C0C0", icon: "🥈", type: 'kills' },
  { req: 50, name: "Gold", color: "#FFD700", icon: "🥇", type: 'kills' },
  { req: 100, name: "Platinum", color: "#E5E4E2", icon: "💎", type: 'kills' },
  { req: 500, name: "Diamond", color: "#00FFFF", icon: "💠", type: 'kills' },
  { req: 1000, name: "Master", color: "#FF00FF", icon: "🔥", type: 'kills' }
];

const WIN_TIERS = [
  { req: 1, name: "Novice", color: "#8B5A2B", icon: "🌱", type: 'wins' },
  { req: 5, name: "Victor", color: "#CD7F32", icon: "🏅", type: 'wins' },
  { req: 10, name: "Champion", color: "#C0C0C0", icon: "🏆", type: 'wins' },
  { req: 25, name: "Legend", color: "#FFD700", icon: "⭐", type: 'wins' },
  { req: 50, name: "Warlord", color: "#00FFFF", icon: "⚔️", type: 'wins' }
];

const STREAK_TIERS = [
  { req: 3, name: "Hot", color: "#CD7F32", icon: "🔥", type: 'streak' },
  { req: 5, name: "Unstoppable", color: "#C0C0C0", icon: "⚡", type: 'streak' },
  { req: 10, name: "Godlike", color: "#FFD700", icon: "🌟", type: 'streak' },
  { req: 20, name: "Grim Reaper", color: "#FF00FF", icon: "💀", type: 'streak' }
];
