// ===== CrazyGames SDK v3 Integration =====
// The v3 SDK MUST be initialized (await SDK.init()) before any other call.
// crazySDK stays null until init succeeds. It also stays null on websites that
// aren't CrazyGames (like GitHub Pages), where the SDK is "disabled" and every call throws.
let crazySDK = null;

async function initCrazySDK() {
  try {
    if (window.CrazyGames && window.CrazyGames.SDK) {
      await window.CrazyGames.SDK.init();
      if (window.CrazyGames.SDK.environment !== "disabled") {
        crazySDK = window.CrazyGames.SDK;
      }
      console.log("CrazyGames SDK environment:", window.CrazyGames.SDK.environment);
    }
  } catch (e) {
    console.warn("CrazyGames SDK init failed (normal outside CrazyGames):", e);
    crazySDK = null;
  }
}
initCrazySDK();

// Gameplay events: CrazyGames wants to know when the player is actually playing.
// Call start when flying begins/resumes, stop on any break (menu, death screen, match end).
// The flag makes sure we never send "start" twice in a row or "stop" twice in a row.
let gameplayActive = false;
function sdkGameplayStart() {
  if (gameplayActive) return;
  gameplayActive = true;
  try { if (crazySDK) crazySDK.game.gameplayStart(); } catch (e) { console.warn(e); }
}
function sdkGameplayStop() {
  if (!gameplayActive) return;
  gameplayActive = false;
  try { if (crazySDK) crazySDK.game.gameplayStop(); } catch (e) { console.warn(e); }
}

// During an ad ALL game sound must be silent (music, SFX, engine hum).
// Suspending the AudioContext pauses every sound at once.
function pauseAudioForAd() { if (audioCtx && audioCtx.state === "running") audioCtx.suspend(); }
function resumeAudioAfterAd() { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume(); }

function triggerMidgameAdAndVote() {
  if (!crazySDK) { startVoting(); return; } // Not on CrazyGames: skip the ad

  // adFinished and adError could in theory both fire, so only continue once.
  let continued = false;
  const continueGame = () => {
    if (continued) return;
    continued = true;
    resumeAudioAfterAd();
    startVoting();
  };

  try {
    crazySDK.ad.requestAd("midgame", {
      adStarted: () => pauseAudioForAd(),
      adFinished: () => continueGame(),
      adError: (error) => { console.log("Midgame ad not shown:", error); continueGame(); }
    });
  } catch (e) { console.warn(e); continueGame(); }
}

let adCountdownInterval = null;

function grantRewardedCoins() {
  userProfile.coins += 500;
  saveProfile();
  buildStore();
  floatTexts.push({ x: canvas.width/2, y: canvas.height/2, text: `+500 🪙 REWARDED AD BONUS!`, life: 3.0 });
}

// Temporarily changes the "Watch Ad" button text so the player knows what happened.
function flashAdButton(message) {
  const btn = document.getElementById("watch-ad-btn");
  if (!btn) return;
  const original = btn.innerText;
  btn.innerText = message; btn.disabled = true;
  setTimeout(() => { btn.innerText = original; btn.disabled = false; }, 2500);
}

function watchRewardedAdForCoins() {
  // NOT on CrazyGames (GitHub Pages, testing): use the fake ad simulator so you can test the flow.
  if (!crazySDK) { openAdSimulator(); return; }

  // ON CrazyGames: coins are ONLY given in adFinished, after the ad really played.
  // If the ad fails (ad blocker, no ad available, cooldown) the player gets nothing.
  // Otherwise ad-blocker users could farm free coins forever.
  try {
    crazySDK.ad.requestAd("rewarded", {
      adStarted: () => pauseAudioForAd(),
      adFinished: () => { resumeAudioAfterAd(); grantRewardedCoins(); },
      adError: (error) => {
        console.log("Rewarded ad not shown:", error);
        resumeAudioAfterAd();
        flashAdButton(error && error.code === "adblock" ? "AD BLOCKER DETECTED" : "NO AD AVAILABLE, TRY LATER");
      }
    });
  } catch (e) { console.warn(e); resumeAudioAfterAd(); flashAdButton("NO AD AVAILABLE, TRY LATER"); }
}

function openAdSimulator() {
  document.getElementById("menu-modal").style.display = "none";
  document.getElementById("ad-simulator-modal").style.display = "flex";
  let timeLeft = 3;
  document.getElementById("ad-countdown-timer").innerText = timeLeft;
  const skipBtn = document.getElementById("skip-ad-btn");
  skipBtn.disabled = true;

  clearInterval(adCountdownInterval);
  adCountdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      document.getElementById("ad-countdown-timer").innerText = timeLeft;
    } else {
      document.getElementById("ad-countdown-timer").innerText = "READY!";
      skipBtn.disabled = false;
      clearInterval(adCountdownInterval);
    }
  }, 1000);
}

function finishRewardedAd() {
  document.getElementById("ad-simulator-modal").style.display = "none";
  document.getElementById("menu-modal").style.display = "flex";
  grantRewardedCoins();
}

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

// Screen Shake Engine State
let screenShakeTimer = 0;
let screenShakeIntensity = 0;

function triggerScreenShake(intensity = 5, duration = 0.15) {
  screenShakeIntensity = intensity;
  screenShakeTimer = duration;
}

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

// Web Audio Engine & Dynamic Engine Hum
let audioCtx = null;
let musicMaster = null;
let activeMusicOscillators = [];
let engineOsc = null;
let engineGain = null;

function initAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext && !audioCtx) audioCtx = new AudioContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    // Start Continuous Engine Hum if not already running
    if (audioCtx && !engineOsc) {
      engineOsc = audioCtx.createOscillator();
      engineGain = audioCtx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.setValueAtTime(65, audioCtx.currentTime); // Base idle hum
      
      let filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, audioCtx.currentTime);

      engineGain.gain.setValueAtTime(0.04, audioCtx.currentTime);

      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(audioCtx.destination);
      engineOsc.start();
    }
  } catch(e) {}
}

function updateEngineHum(isBoosting, isAlive) {
  if (!audioCtx || !engineOsc || !engineGain) return;
  let t = audioCtx.currentTime;
  let vMult = (userProfile.sfxVol / 100);
  
  if (!isAlive || !isRoundActive) {
    engineGain.gain.setTargetAtTime(0, t, 0.1);
    return;
  }

  if (isBoosting) {
    engineGain.gain.setTargetAtTime(0.18 * vMult, t, 0.06);
    engineOsc.frequency.setTargetAtTime(160, t, 0.08); 
  } else {
    engineGain.gain.setTargetAtTime(0.05 * vMult, t, 0.1);
    engineOsc.frequency.setTargetAtTime(65, t, 0.1);  
  }
}

function playAudio(type) {
  if (!audioCtx || userProfile.sfxVol == 0) return;
  try {
    const t = audioCtx.currentTime;
    let vMult = (userProfile.sfxVol / 100);

    if (type === 'hit') {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(1200, t);
      gain.gain.setValueAtTime(0.3 * vMult, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.05);
      osc.start(t); osc.stop(t + 0.05);
    } else if (type === 'kill') {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1760, t + 0.15);
      gain.gain.setValueAtTime(0.4 * vMult, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    } else if (type === 'player_death' || type === 'boom') {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sawtooth'; 
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.6);
      gain.gain.setValueAtTime(0.6 * vMult, t); 
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
      osc.start(t); osc.stop(t + 0.6);

      const sub = audioCtx.createOscillator(); const subGain = audioCtx.createGain();
      sub.connect(subGain); subGain.connect(audioCtx.destination);
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(80, t);
      sub.frequency.exponentialRampToValueAtTime(10, t + 0.8);
      subGain.gain.setValueAtTime(0.8 * vMult, t);
      subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
      sub.start(t); sub.stop(t + 0.8);
    } else if (type === 'cannon') {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'square'; osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);
      gain.gain.setValueAtTime(0.1 * vMult, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    } else if (type === 'laser') {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.5);
      gain.gain.setValueAtTime(0.3 * vMult, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.5);
      osc.start(t); osc.stop(t + 0.5);
    }
  } catch(e) {}
}

function setMusicTheme(theme) {
  if (!audioCtx) initAudio();
  if (!audioCtx) return;
  if (!musicMaster) { musicMaster = audioCtx.createGain(); musicMaster.connect(audioCtx.destination); }
  
  musicMaster.gain.value = (userProfile.musicVol / 100) * 0.25;

  activeMusicOscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch(e){} });
  activeMusicOscillators = [];

  let notes = []; let type = 'sine'; let cutoff = 1000;
  
  if (theme === 'clouds') { notes = [220, 277.18, 329.63]; type = 'sine'; }
  else if (theme === 'lava') { notes = [65.41, 69.30]; type = 'sawtooth'; cutoff = 400; }
  else if (theme === 'cyber') { notes = [146.83, 174.61, 220]; type = 'square'; musicMaster.gain.value *= 0.15; cutoff = 500; }
  else if (theme === 'snow') { notes = [880, 1046.50, 1318.51]; type = 'sine'; musicMaster.gain.value *= 0.5; }
  else if (theme === 'acid') { notes = [130.81, 138.59]; type = 'triangle'; }
  else if (theme === 'stars') { notes = [110, 164.81, 220]; type = 'sine'; }
  else if (theme === 'voting') { notes = [261.63, 329.63, 392.00]; type = 'sine'; musicMaster.gain.value *= 0.4; cutoff = 800; } 

  notes.forEach((freq, i) => {
    let osc = audioCtx.createOscillator(); let lfo = audioCtx.createOscillator();
    let lfoGain = audioCtx.createGain(); let oscGain = audioCtx.createGain();

    osc.type = type; osc.frequency.value = freq;
    let filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff;
    oscGain.gain.value = 0.5 / notes.length;

    lfo.type = 'sine'; lfo.frequency.value = (theme === 'voting') ? 0.05 + (i * 0.02) : 0.1 + (i * 0.05); 
    lfo.connect(lfoGain); lfoGain.gain.value = 0.5; lfoGain.connect(oscGain.gain);
    lfo.start(); activeMusicOscillators.push(lfo);

    osc.connect(filter); filter.connect(oscGain); oscGain.connect(musicMaster);
    osc.start(); activeMusicOscillators.push(osc);
  });
}

function updateSettings() {
  userProfile.musicVol = parseInt(document.getElementById("music-vol").value);
  userProfile.sfxVol = parseInt(document.getElementById("sfx-vol").value);
  userProfile.botDifficulty = parseInt(document.getElementById("bot-diff").value);
  userProfile.botPersonalities = document.getElementById("bot-personalities-toggle").checked;
  saveProfile();
  if (musicMaster) musicMaster.gain.value = (userProfile.musicVol / 100) * 0.25;
}

function openSettings() {
  document.getElementById("music-vol").value = userProfile.musicVol;
  document.getElementById("sfx-vol").value = userProfile.sfxVol;
  document.getElementById("bot-diff").value = userProfile.botDifficulty;
  document.getElementById("bot-personalities-toggle").checked = userProfile.botPersonalities;
  document.getElementById("menu-modal").style.display = "none";
  document.getElementById("settings-modal").style.display = "flex";
}

function openBadges() {
  document.getElementById("menu-modal").style.display = "none";
  document.getElementById("badges-modal").style.display = "flex";
  
  document.getElementById("badge-kills-txt").innerText = userProfile.careerKills;
  document.getElementById("badge-wins-txt").innerText = userProfile.careerWins;
  document.getElementById("badge-streak-txt").innerText = userProfile.highestStreak;

  const buildRow = (containerId, tierList, currentVal) => {
    const cont = document.getElementById(containerId); cont.innerHTML = "";
    tierList.forEach(tier => {
      let isUnlocked = currentVal >= tier.req;
      let badgeKey = `${tier.type}-${tier.name}`;
      let isEquipped = (userProfile.equippedBadge === badgeKey);
      
      let div = document.createElement("div");
      div.className = `badge-item ${isUnlocked ? 'unlocked' : ''} ${isEquipped ? 'equipped' : ''}`;
      div.style.borderColor = isEquipped ? '#22c55e' : (isUnlocked ? tier.color : '#334155');
      div.innerHTML = `<div class="badge-icon">${tier.icon}</div><div class="badge-name" style="color:${isUnlocked?tier.color:'#fff'};">${tier.name}</div><div class="badge-req">${tier.req}</div>`;
      
      if (isUnlocked) {
        div.onclick = () => {
          if (userProfile.equippedBadge === badgeKey) {
            userProfile.equippedBadge = null; 
          } else {
            userProfile.equippedBadge = badgeKey; 
          }
          saveProfile();
          openBadges(); 
        };
      }
      cont.appendChild(div);
    });
  };

  buildRow("badge-row-kills", BADGE_TIERS, userProfile.careerKills);
  buildRow("badge-row-wins", WIN_TIERS, userProfile.careerWins);
  buildRow("badge-row-streak", STREAK_TIERS, userProfile.highestStreak);
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
  document.getElementById("menu-modal").style.display = "flex";
}

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

function showKillBanner(victimName, isRevenge, isKingslayer) {
  if (isInHangar || !player.alive) return;
  const el = document.getElementById("kill-announcer");
  let topText = "SHOT DOWN";
  if (isRevenge) topText = "REVENGE!";
  if (isKingslayer) topText = "KINGSLAYER!";
  
  el.innerHTML = `<div class="ka-top">${topText}</div><div class="ka-bot">${victimName}</div>`;
  el.className = 'show';
  clearTimeout(killAnnounceTimeout);
  killAnnounceTimeout = setTimeout(() => el.className = '', 2500);
}

function spawnKillLog(victim, killer) {
  if (isInHangar) return;
  if (victim === player || killer === player) {
    if (!player.alive) return;
  }
  const feed = document.getElementById("kill-feed"); const log = document.createElement("div"); log.className = "kill-log";
  let kName = killer ? killer.name : "Environment"; let kColor = killer === player ? "#38bdf8" : (killer ? "#fbbf24" : "#94a3b8"); let vColor = victim === player ? "#38bdf8" : "#fff";
  log.innerHTML = `• <span style="color:${vColor}">${victim.name}</span> was shot down by <span style="color:${kColor}">${kName}</span>`;
  feed.appendChild(log); setTimeout(() => { if (log.parentElement) log.remove(); }, 4000);
}

function switchTab(tabName) {
  document.getElementById("skins-tab").classList.remove('active-tab');
  document.getElementById("trails-tab").classList.remove('active-tab');
  document.getElementById("tab-btn-skins").classList.remove('active');
  document.getElementById("tab-btn-trails").classList.remove('active');
  
  document.getElementById(tabName + "-tab").classList.add('active-tab');
  document.getElementById("tab-btn-" + tabName).classList.add('active');
  buildStore();
}

function buildStore() {
  document.getElementById("player-name-input").value = userProfile.name;
  document.getElementById("name-display").innerText = userProfile.name;
  updateTopBarXP();
  
  const skinCont = document.getElementById("skin-grid-container"); skinCont.innerHTML = "";
  SKINS.forEach(skin => {
    const isOwned = userProfile.ownedSkins.includes(skin.id);
    const hasLevelReq = userProfile.level >= skin.minLevel;
    const card = document.createElement("div"); card.className = `item-card ${viewingSkin.id === skin.id ? 'active-sel' : ''}`;
    
    const cvs = document.createElement("canvas"); cvs.width = 80; cvs.height = 80; cvs.className = "preview-canvas";
    const pCtx = cvs.getContext("2d"); pCtx.translate(40, 40); pCtx.rotate(-Math.PI/4); pCtx.scale(1.5, 1.5);
    pCtx.fillStyle = isOwned ? userProfile.activeColor : '#334155'; pCtx.shadowBlur = isOwned ? 15 : 0; pCtx.shadowColor = userProfile.activeColor;
    pCtx.beginPath(); skin.draw(pCtx); pCtx.fill(); pCtx.stroke(); pCtx.shadowBlur = 0;
    pCtx.fillStyle = "#fff"; pCtx.beginPath(); pCtx.arc(4, 0, 2.5, 0, Math.PI*2); pCtx.fill();
    
    let priceText = isOwned ? 'OWNED' : (hasLevelReq ? `🪙 ${skin.price}` : `🔒 LVL ${skin.minLevel}`);
    card.innerHTML = `<div class="item-info"><span style="color:${isOwned?'#fff':'#94a3b8'}">${skin.name}</span> <span style="color:${hasLevelReq?'#fbbf24':'#ef4444'}">${priceText}</span></div>`;
    card.insertBefore(cvs, card.firstChild); card.onclick = () => { viewingSkin = skin; buildStore(); }; skinCont.appendChild(card);
  });

  const trailCont = document.getElementById("trail-grid-container"); trailCont.innerHTML = "";
  TRAILS.forEach(trail => {
    const isOwned = userProfile.ownedTrails.includes(trail.id);
    const card = document.createElement("div"); card.className = `item-card ${viewingTrail.id === trail.id ? 'active-sel' : ''}`;
    
    const cvs = document.createElement("canvas"); cvs.width = 80; cvs.height = 80; cvs.className = "preview-canvas";
    const pCtx = cvs.getContext("2d");
    
    for(let i=0; i<8; i++) {
      let ty = 20 + i*6; let tx = 40;
      let tCol = trail.color === 'rainbow' ? `hsl(${i*40}, 100%, 50%)` : trail.color;
      pCtx.fillStyle = isOwned ? tCol : '#475569'; pCtx.globalAlpha = 1 - (i*0.1);
      if(trail.shape === 'square') pCtx.fillRect(tx-4, ty-4, 8, 8);
      else if(trail.shape === 'star') { pCtx.beginPath(); pCtx.moveTo(tx, ty-4); pCtx.lineTo(tx+2, ty-1); pCtx.lineTo(tx+4, ty); pCtx.lineTo(tx+2, ty+1); pCtx.lineTo(tx, ty+4); pCtx.lineTo(tx-2, ty+1); pCtx.lineTo(tx-4, ty); pCtx.lineTo(tx-2, ty-1); pCtx.fill(); }
      else { pCtx.beginPath(); pCtx.arc(tx, ty, 4, 0, Math.PI*2); pCtx.fill(); }
    }
    pCtx.globalAlpha = 1; pCtx.fillStyle = '#fff'; pCtx.beginPath(); pCtx.moveTo(40,10); pCtx.lineTo(30,30); pCtx.lineTo(50,30); pCtx.fill();

    card.innerHTML = `<div class="item-info"><span style="color:${isOwned?'#fff':'#94a3b8'}">${trail.name}</span> <span style="color:#fbbf24">${isOwned ? 'OWNED' : '🪙'+trail.price}</span></div>`;
    card.insertBefore(cvs, card.firstChild); card.onclick = () => { viewingTrail = trail; buildStore(); }; trailCont.appendChild(card);
  });

  const colorCont = document.getElementById("color-grid-container"); colorCont.innerHTML = "";
  COLORS.forEach(col => {
    const isOwned = userProfile.ownedColors.includes(col);
    const sw = document.createElement("div"); 
    sw.className = `color-swatch ${userProfile.activeColor === col ? 'active' : ''} ${!isOwned ? 'locked' : ''}`; 
    sw.style.backgroundColor = isOwned ? col : '#1e293b'; 
    sw.style.borderColor = isOwned ? col : 'rgba(255,255,255,0.2)';
    
    if (!isOwned) {
      sw.innerHTML = `<span style="font-size:12px;">🔒</span>`;
    } else {
      sw.innerHTML = ``;
      sw.onclick = () => { userProfile.activeColor = col; player.color = col; saveProfile(); buildStore(); };
    }
    colorCont.appendChild(sw);
  });

  const buyBtn = document.getElementById("buy-btn"); const launchBtn = document.getElementById("launch-btn");
  let totalCost = 0;
  let canBuy = true;
  if (!userProfile.ownedSkins.includes(viewingSkin.id)) {
    if (userProfile.level < viewingSkin.minLevel) canBuy = false;
    totalCost += viewingSkin.price;
  }
  if (!userProfile.ownedTrails.includes(viewingTrail.id)) totalCost += viewingTrail.price;

  if (totalCost === 0) {
    buyBtn.style.display = "none"; launchBtn.style.display = "block";
  } else {
    buyBtn.style.display = "block"; launchBtn.style.display = "none";
    if (!canBuy) {
      buyBtn.disabled = true; buyBtn.innerText = `REQUIRES LEVEL ${viewingSkin.minLevel}`;
    } else if (userProfile.coins >= totalCost) { 
      buyBtn.disabled = false; buyBtn.innerText = `BUY SELECTED (🪙 ${totalCost})`; 
    } else { 
      buyBtn.disabled = true; buyBtn.innerText = `NEED 🪙 ${totalCost - userProfile.coins} MORE`; 
    }
  }
}

function buySelected() {
  let totalCost = 0;
  if (!userProfile.ownedSkins.includes(viewingSkin.id)) {
    if (userProfile.level < viewingSkin.minLevel) return;
    totalCost += viewingSkin.price;
  }
  if (!userProfile.ownedTrails.includes(viewingTrail.id)) totalCost += viewingTrail.price;

  if (userProfile.coins >= totalCost) {
    userProfile.coins -= totalCost;
    if (!userProfile.ownedSkins.includes(viewingSkin.id)) userProfile.ownedSkins.push(viewingSkin.id);
    if (!userProfile.ownedTrails.includes(viewingTrail.id)) userProfile.ownedTrails.push(viewingTrail.id);
    saveProfile(); buildStore();
  }
}

window.addEventListener('DOMContentLoaded', () => { 
  viewingSkin = SKINS.find(s=>s.id===userProfile.activeSkin) || SKINS[0]; 
  viewingTrail = TRAILS.find(t=>t.id===userProfile.activeTrail) || TRAILS[0]; 
  if (!envObjects.length) initEnvironment();
  isRoundActive = true;
  player.alive = false;
  buildStore(); 
  openMenu(); 
  checkDailyLogin();
});

function rollPaint() {
  if (userProfile.coins < 100) return;
  const unowned = COLORS.filter(c => !userProfile.ownedColors.includes(c));
  if (unowned.length === 0) return;
  userProfile.coins -= 100;
  const newColor = unowned[Math.floor(Math.random() * unowned.length)];
  userProfile.ownedColors.push(newColor); userProfile.activeColor = newColor; player.color = newColor;
  saveProfile(); buildStore();
}

function handleLaunch() {
  initAudio();
  const nameVal = document.getElementById("player-name-input").value.trim() || "Pilot";
  userProfile.name = nameVal; player.name = nameVal; document.getElementById("name-display").innerText = nameVal;
  
  userProfile.activeSkin = viewingSkin.id; player.skinObj = viewingSkin;
  userProfile.activeTrail = viewingTrail.id; player.trailObj = viewingTrail;
  
  saveProfile(); buildStore(); document.getElementById("menu-modal").style.display = "none"; 
  isInHangar = false;

  if (!hasLeftMatchOnce) {
    hasLeftMatchOnce = true;
    userProfile.stats.totalGames++;
    saveProfile();
    startMatch();
  } else {
    player.roundKills = savedMatchKills;
    player.lifeKills = savedLifeKills;
    player.currentStreak = savedCurrentStreak;
    player.maxStreak = savedMaxStreak;
    player.lifeTimer = savedLifeTimer;
    player.weapon = savedWeapon;
    player.ammo = savedAmmo;
    player.hp = savedHp > 0 ? savedHp : player.maxHp;
    player.boost = savedBoost;
    player.x = savedPosX !== null ? savedPosX : Math.random() * WORLD_WIDTH;
    player.y = savedPosY !== null ? savedPosY : 400 + Math.random() * 600;
    player.angle = savedAngle;
    player.laserTimer = 0;
    player.evadeTimer = 0;
    player.flashTimer = 0;
    player.alive = true;
    isRoundActive = true;
    document.getElementById("match-kills-txt").innerText = String(player.roundKills);
    updateWeaponUI();
    setMusicTheme(MAPS[currentMapIdx].env);
    sdkGameplayStart(); // back in the air after the menu
  }
}

const ARCHETYPES = ['sniper', 'brawler', 'speed_demon'];

function startMatch() {
  initEnvironment(); roundTimer = 120; revengeTarget = null;
  [player, ...bots].forEach(p => { 
    p.roundKills = 0; p.lifeKills = 0; p.currentStreak = 0; p.maxStreak = 0;
    p.maxHp = 100;
    p.hp = p.maxHp; 
    p.weapon = "CANNON"; 
    p.ammo = Infinity; p.x = Math.random()*WORLD_WIDTH; p.y = 600; p.alive = true; p.evadeTimer = 0; 
    p.trailTimer = 0; p.lifeTimer = 0; p.laserTimer = 0; p.respawnTimer = 0;
    p.dodgeDir = 0; p.evadeDir = 0; p.flashTimer = 0;
    
    if (p.isBot) {
      const allTierIcons = [...BADGE_TIERS, ...WIN_TIERS, ...STREAK_TIERS];
      p.botBadge = allTierIcons[Math.floor(Math.random() * allTierIcons.length)].icon;
      p.archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
    }
  });
  bullets = []; missiles = []; crates = []; mines = []; floatTexts = []; particles = []; 
  updateWeaponUI(); isRoundActive = true;
  document.getElementById("match-kills-txt").innerText = "0";
  setMusicTheme(MAPS[currentMapIdx].env);
  if (!isInHangar) sdkGameplayStart(); // new match begins with the player flying
}

function respawnPlayer() {
  document.getElementById("death-modal").style.display = "none";
  player.x = Math.random() * WORLD_WIDTH; player.y = 400 + Math.random() * 600;
  player.hp = player.maxHp; player.weapon = "CANNON"; player.ammo = Infinity;
  player.alive = true; player.evadeTimer = 0; player.trailTimer = 0; player.laserTimer = 0;
  player.lifeKills = 0; player.lifeTimer = 0; player.flashTimer = 0;
  document.getElementById("match-kills-txt").innerText = String(player.roundKills);
  updateWeaponUI();
  sdkGameplayStart(); // respawned = playing again
}

function openMenu() { 
  if (!isInHangar && hasLeftMatchOnce) {
    savedMatchKills = player.roundKills;
    savedLifeKills = player.lifeKills;
    savedCurrentStreak = player.currentStreak;
    savedMaxStreak = player.maxStreak;
    savedLifeTimer = player.lifeTimer;
    savedWeapon = player.weapon;
    savedAmmo = player.ammo;
    savedHp = player.hp;
    savedBoost = player.boost;
    savedPosX = player.x;
    savedPosY = player.y;
    savedAngle = player.angle;
  }
  sdkGameplayStop(); // menu = break in gameplay
  isInHangar = true;
  player.alive = false;
  player.laserTimer = 0;
  mouse.down = false;
  document.getElementById("out-of-bounds-warning").style.display = "none";
  document.getElementById("kill-announcer").className = '';
  updateEngineHum(false, false);
  if (!envObjects.length) initEnvironment();
  viewingSkin = SKINS.find(s=>s.id===userProfile.activeSkin) || SKINS[0]; 
  viewingTrail = TRAILS.find(t=>t.id===userProfile.activeTrail) || TRAILS[0]; 
  buildStore(); document.getElementById("menu-modal").style.display = "flex"; 
}

function openLeaderboards() { document.getElementById("leaderboard-modal").style.display = "flex"; renderLeaderboards('all'); }
function closeLeaderboards() { document.getElementById("leaderboard-modal").style.display = "none"; }

const MOCK_SWEATS = ["V3nom", "GhostFace", "AimBot", "TitanSlayer", "Shadowx", "NoScope", "SkyKing", "Reaper", "Toxik"];
function renderLeaderboards(tab) {
  const content = document.getElementById("lb-content");
  let baseScore = tab === 'all' ? 45000 : (tab === 'week' ? 5400 : 1200);
  let entries = MOCK_SWEATS.map((n, i) => ({ name: n, score: baseScore - (i * Math.floor(baseScore/15)) + Math.floor(Math.random()*(baseScore/20)), isMe: false }));
  entries.push({ name: userProfile.name, score: userProfile.careerKills, isMe: true });
  entries.sort((a,b) => b.score - a.score);
  content.innerHTML = entries.map((e, i) => `<div class="rank-row ${e.isMe ? 'you' : (i===0 ? 'first' : '')}"><span>#${i+1} ${e.name} ${i===0 ? '👑' : ''}</span><span>⚔️ ${e.score}</span></div>`).join('');
}

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

class Plane {
  constructor(x, y, name, isBot = false, skinObj, color, trailObj) {
    this.x = x; this.y = y; this.name = name; this.isBot = isBot; this.skinObj = skinObj; this.color = color; this.trailObj = trailObj;
    this.angle = 0; this.speed = 4.5; 
    this.maxHp = 100;
    this.hp = this.maxHp; 
    this.boost = 100;
    this.roundKills = 0; this.lifeKills = 0; this.currentStreak = 0; this.maxStreak = 0; this.alive = true; 
    this.weapon = "CANNON"; this.ammo = Infinity; this.lastShot = 0; this.evadeTimer = 0; this.trailTimer = 0; this.lifeTimer = 0;
    this.laserTimer = 0; this.respawnTimer = 0;
    this.dodgeDir = 0; 
    this.evadeDir = 0; 
    this.flashTimer = 0;
    this.botBadge = "";
    this.archetype = 'brawler';
  }

  update(dt) {
    if (!this.alive) {
      if (this.isBot && isRoundActive) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.x = Math.random() * WORLD_WIDTH; this.y = 400 + Math.random() * 600;
          this.hp = this.maxHp; this.weapon = "CANNON"; this.ammo = Infinity;
          this.alive = true; this.evadeTimer = 0; this.trailTimer = 0; this.laserTimer = 0;
          this.lifeKills = 0; this.lifeTimer = 0; this.flashTimer = 0;
          this.dodgeDir = 0; this.evadeDir = 0;
        }
      }
      return;
    }

    if (this === player && isInHangar) return;

    this.lifeTimer += dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (!isRoundActive && !this.isBot) return;
    
    // Out of Bounds Logic
    let isOutOfBounds = (this.x < 0 || this.x > WORLD_WIDTH || this.y < 0);
    if (isOutOfBounds) {
      this.hp -= 20 * dt; 
      this.flashTimer = 0.1;
      if (this === player) triggerScreenShake(4, 0.1);
      if (this.hp <= 0 && this.alive) this.die(null);
    }
    
    if (this === player) {
      const oobElem = document.getElementById("out-of-bounds-warning");
      if (isOutOfBounds && this.alive && isRoundActive) {
        oobElem.style.display = "flex";
      } else {
        oobElem.style.display = "none";
      }
    }

    let tAngle = this.angle, shoot = false, boost = false;
    let moveAngle = this.angle; 
    
    if (!this.isBot && isRoundActive) {
      tAngle = Math.atan2(mouse.y - canvas.height/2, mouse.x - canvas.width/2); 
      moveAngle = tAngle;
      shoot = mouse.down; boost = keys.space && this.boost > 5;
      updateEngineHum(boost, this.alive);
    } else if (this.isBot) {
      let df = userProfile.botDifficulty / 10; 
      let isGodMode = (userProfile.botDifficulty === 10);
      let errMult = 1 - df;

      let clusterCount = 0; let avoidX = 0, avoidY = 0;
      [...bots, ...(isInHangar ? [] : [player])].forEach(other => { if (other !== this && other.alive && Math.hypot(other.x - this.x, other.y - this.y) < 200) { avoidX += (this.x - other.x); avoidY += (this.y - other.y); clusterCount++; } });

      let dodging = false;
      if (isGodMode || df > 0.7) {
        let dangerousProjectiles = [...bullets, ...missiles];
        for (let i = 0; i < dangerousProjectiles.length; i++) {
          let p = dangerousProjectiles[i];
          if (p.owner !== this) {
            let d = Math.hypot(p.x - this.x, p.y - this.y);
            if (d < 500) {
              let pVx = p.vx || (Math.cos(p.angle) * p.speed * 60);
              let pVy = p.vy || (Math.sin(p.angle) * p.speed * 60);
              
              let toBotX = this.x - p.x; let toBotY = this.y - p.y;
              let dot = (toBotX * pVx + toBotY * pVy) / (Math.hypot(pVx, pVy) * d);
              
              if (dot > 0.85) { 
                if (this.dodgeDir === 0) this.dodgeDir = Math.random() > 0.5 ? 1 : -1;
                tAngle = Math.atan2(pVy, pVx) + (Math.PI/2 * this.dodgeDir);
                moveAngle = tAngle;
                if (this.boost > 5) boost = true;
                dodging = true;
                break;
              }
            }
          }
        }
      }
      
      if (!dodging) this.dodgeDir = 0; 

      if (this.evadeTimer > 0 && !dodging) { 
        this.evadeTimer -= dt; 
        if (this.evadeDir === 0) this.evadeDir = Math.random() > 0.5 ? 1 : -1;
        tAngle = this.angle + (1.5 * this.evadeDir); 
        moveAngle = tAngle;
        if (this.boost > 5) boost = true; 
      } 
      else {
        this.evadeDir = 0; 
        if (clusterCount > 0 && !dodging) { 
          tAngle = Math.atan2(avoidY, avoidX); 
          moveAngle = tAngle;
          if (this.boost > 20) boost = true; 
        } 
        else if (!dodging) {
          
          let cCrate = null, mCrateDist = isGodMode ? 2500 : 500 - (df * 200);
          crates.forEach(c => { 
            let d = Math.hypot(c.x-this.x, c.y-this.y); 
            let weight = d;
            if (isGodMode && this.hp < (this.maxHp*0.3) && c.type === "SHIELD") weight *= 0.1; 
            if (isGodMode && this.weapon === "CANNON" && c.type !== "SHIELD") weight *= 0.2;
            if(weight < mCrateDist){ mCrateDist = weight; cCrate = c; }
          });

          if (cCrate && (this.weapon === "CANNON" || (isGodMode && this.hp < (this.maxHp*0.3) && cCrate.type === "SHIELD"))) { 
            tAngle = Math.atan2(cCrate.y - this.y, cCrate.x - this.x); 
            moveAngle = tAngle;
            if (isGodMode && this.boost > 10) boost = true;
          } 
          else {
            if (!this.target || !this.target.alive || (this.target === player && isInHangar) || Math.random() < 0.05) { 
              const pool = [...bots, ...(isInHangar ? [] : [player])].filter(p => p !== this && p.alive); 
              if (pool.length > 0) {
                pool.sort((a,b) => {
                  let distA = Math.hypot(a.x-this.x, a.y-this.y);
                  let distB = Math.hypot(b.x-this.x, b.y-this.y);
                  let playerBias = (df * 2500); 
                  let scoreA = distA - (a === player ? playerBias : 0);
                  let scoreB = distB - (b === player ? playerBias : 0);
                  return scoreA - scoreB;
                });
                this.target = pool[0]; 
              }
            }
            
            if (this.target) {
              let dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
              
              let errX = isGodMode ? 0 : (Math.random() - 0.5) * errMult * 300;
              let errY = isGodMode ? 0 : (Math.random() - 0.5) * errMult * 300;
              
              let bSpeed = this.weapon === "LASER" ? 99999 : ((this.weapon === "PLASMA" ? 12 : 25) * 60);
              let timeToHit = dist / Math.max(1, bSpeed);
              
              let targetVx = Math.cos(this.target.angle) * this.target.speed * 40;
              let targetVy = Math.sin(this.target.angle) * this.target.speed * 40;
              
              let predX = this.target.x + (targetVx * timeToHit) + errX;
              let predY = this.target.y + (targetVy * timeToHit) + errY;
              
              tAngle = Math.atan2(predY - this.y, predX - this.x);
              
              moveAngle = tAngle;

              if (userProfile.botPersonalities) {
                if (this.archetype === 'sniper') {
                  if (this.weapon === "CANNON" && Math.random() < 0.02) this.weapon = "LASER";
                  if (dist < 500) moveAngle += Math.PI; 
                } else if (this.archetype === 'brawler') {
                  if (this.weapon === "CANNON" && Math.random() < 0.02) this.weapon = "SHOTGUN";
                } else if (this.archetype === 'speed_demon') {
                  if (this.boost > 10) boost = true; 
                }
              }

              if (dist < 1500 && dist > 250 && (!userProfile.botPersonalities || this.archetype !== 'sniper')) {
                moveAngle += Math.sin(Date.now() / 300 + this.x * 0.01) * 0.6 * df;
              }

              let aimDiff = Math.abs(tAngle - this.angle); while(aimDiff > Math.PI) aimDiff -= Math.PI*2; while(aimDiff < -Math.PI) aimDiff += Math.PI*2;
              aimDiff = Math.abs(aimDiff);

              let aimTolerance = isGodMode ? 0.15 : 0.08 + errMult * 0.4;
              let maxShootDist = (userProfile.botPersonalities && this.archetype === 'sniper') ? 1400 : 700;
              if (dist < maxShootDist && aimDiff < aimTolerance && isRoundActive) shoot = true;
              
              let boostDist = (userProfile.botPersonalities && this.archetype === 'speed_demon') ? 200 : 400;
              if ((dist > boostDist || (userProfile.botPersonalities && this.archetype === 'speed_demon')) && this.boost > 15) boost = true;
            }
          }
        }
      }
      
      let nearBorder = false;
      if (this.x < 300) { moveAngle = 0; nearBorder = true; }
      else if (this.x > WORLD_WIDTH - 300) { moveAngle = Math.PI; nearBorder = true; }
      
      if (this.y < 300) { moveAngle = Math.PI/2; nearBorder = true; }
      else if (this.y > seaLevel - 250) { moveAngle = -Math.PI/2; nearBorder = true; }

      if (nearBorder && this.boost > 0) boost = true;
    }

    let diff = moveAngle - this.angle; while(diff < -Math.PI) diff += Math.PI*2; while(diff > Math.PI) diff -= Math.PI*2; 
    let turnSpeedBuff = (this.isBot && userProfile.botDifficulty === 10) ? 1.5 : 0;
    let turnSpeed = 3.5 + (this.isBot ? (userProfile.botDifficulty/10) * turnSpeedBuff : 0);
    this.angle += diff * turnSpeed * dt;

    let mSpd = boost ? 9.5 : 4.5;
    if (userProfile.botPersonalities && this.archetype === 'speed_demon' && boost) mSpd = 11.0;

    if (boost) { this.boost = Math.max(0, this.boost - 25*dt); } else { this.boost = Math.min(100, this.boost + 12*dt); }
    
    this.trailTimer += dt;
    let spawnRate = boost ? 0.015 : 0.04;
    while(this.trailTimer > spawnRate) {
      this.trailTimer -= spawnRate;
      let tColor = this.trailObj.color === 'rainbow' ? `hsl(${Math.random()*360}, 100%, 50%)` : this.trailObj.color;
      particles.push({ 
        x: this.x - Math.cos(this.angle)*15 + (Math.random()-0.5)*6, 
        y: this.y - Math.sin(this.angle)*15 + (Math.random()-0.5)*6, 
        vx: -Math.cos(this.angle)*(boost?4:1.5) + (Math.random()-0.5)*1.5, 
        vy: -Math.sin(this.angle)*(boost?4:1.5) + (Math.random()-0.5)*1.5, 
        color: tColor, size: boost?6:4, life: 1.0, shape: this.trailObj.shape || 'circle' 
      });
    }

    if (this === player && isRoundActive && !isInHangar) {
      let distMoved = this.speed * 40 * dt;
      userProfile.stats.distanceFlown += Math.round(distMoved);
    }

    if (this.laserTimer > 0) {
      this.laserTimer -= dt;
      let dmgMult = this === player ? (1.0 - ((userProfile.botDifficulty - 1) / 9) * 0.6) : 1.0;
      
      let nx = Math.cos(this.angle); let ny = Math.sin(this.angle);
      [...bots, ...(isInHangar ? [] : [player])].forEach(p => {
        if (!p.alive || p === this) return;
        let dx = p.x - this.x; let dy = p.y - this.y;
        let dot = dx * nx + dy * ny;
        if (dot > 0 && dot < 2500) {
          let projX = this.x + nx * dot; let projY = this.y + ny * dot;
          if (Math.hypot(p.x - projX, p.y - projY) < 40) {
            let dmg = (200 * dmgMult) * dt;
            p.hp -= dmg; 
            p.flashTimer = 0.1;
            if (p === player) triggerScreenShake(3, 0.08);
            if (p.isBot) p.evadeTimer = 1.0;
            if (p.hp <= 0) p.die(this);
          }
        }
      });
    }

    this.speed += (mSpd - this.speed) * 3 * dt; 
    this.x += Math.cos(this.angle) * this.speed * 40 * dt; 
    this.y += Math.sin(this.angle) * this.speed * 40 * dt;
    
    // Instakill if you fly completely into the ocean
    if(this.y >= seaLevel) {
      if (this === player) triggerScreenShake(12, 0.3);
      this.die(null);
    }

    this.lastShot += dt; if(shoot) this.fire();
  }

  fire() {
    let dmgMult = this === player ? (1.0 - ((userProfile.botDifficulty - 1) / 9) * 0.6) : 1.0;
    let botFireRateMultiplier = this.isBot ? (1.0 - ((userProfile.botDifficulty - 1) / 9) * 0.75) : 1.0;

    if (this.weapon === "LASER") {
      if (this.laserTimer <= 0 && this.lastShot >= (1.0 * botFireRateMultiplier)) {
        this.laserTimer = 2.5; this.lastShot = 0; this.ammo--;
        if(!this.isBot) playAudio('laser');
      }
    }
    else if (this.weapon === "CANNON" && this.lastShot >= (0.14 * botFireRateMultiplier)) {
      this.lastShot = 0; if(!this.isBot) playAudio('cannon');
      bullets.push({ type: 'cannon', x: this.x, y: this.y, vx: Math.cos(this.angle)*25, vy: Math.sin(this.angle)*25, dmg: 16 * dmgMult, owner: this, color: "#fbbf24", life: 1.2 });
    } else if (this.weapon === "SHOTGUN" && this.lastShot >= (0.35 * botFireRateMultiplier)) {
      this.lastShot = 0; if(!this.isBot) playAudio('cannon');
      for(let i=-2; i<=2; i++) bullets.push({ type: 'shotgun', x: this.x, y: this.y, vx: Math.cos(this.angle+i*0.08)*20, vy: Math.sin(this.angle+i*0.08)*20, dmg: 12 * dmgMult, owner: this, color: "#38bdf8", life: 0.8 });
      this.ammo--;
    } else if (this.weapon === "PLASMA" && this.lastShot >= (0.8 * botFireRateMultiplier)) {
      this.lastShot = 0; if(!this.isBot) playAudio('cannon');
      bullets.push({ type: 'plasma', x: this.x, y: this.y, vx: Math.cos(this.angle)*12, vy: Math.sin(this.angle)*12, dmg: 40 * dmgMult, owner: this, color: "#facc15", life: 2.0 });
      this.ammo--;
    } else if (this.weapon === "FLAK" && this.lastShot >= (0.6 * botFireRateMultiplier)) {
      this.lastShot = 0; if(!this.isBot) playAudio('cannon');
      for(let i=-3; i<=3; i++) bullets.push({ type: 'cannon', x: this.x, y: this.y, vx: Math.cos(this.angle+i*0.15)*18, vy: Math.sin(this.angle+i*0.15)*18, dmg: 14 * dmgMult, owner: this, color: "#f97316", life: 1.0 });
      this.ammo--;
    } else if (this.weapon === "MISSILE" && this.lastShot >= (0.5 * botFireRateMultiplier)) {
      this.lastShot = 0; missiles.push({ x: this.x, y: this.y, angle: this.angle, speed: 13, owner: this, life: 3.5, dmg: 45 * dmgMult }); this.ammo--;
    } else if (this.weapon === "MINES" && this.lastShot >= (0.6 * botFireRateMultiplier)) {
      this.lastShot = 0; if(!this.isBot) playAudio('cannon');
      mines.push({ x: this.x, y: this.y, owner: this, life: 15.0, dmg: 60 * dmgMult }); this.ammo--;
    }
    if (this.ammo <= 0) { this.weapon = "CANNON"; this.ammo = Infinity; if(!this.isBot) updateWeaponUI(); }
  }

  die(killer) {
    if (!this.alive) return; this.alive = false; 
    
    if (this === player && !isInHangar) { 
      document.getElementById("out-of-bounds-warning").style.display = "none";
      playAudio('player_death'); 
      triggerScreenShake(14, 0.3);
      updateEngineHum(false, false);
    } 
    else if (killer === player && !isInHangar) { playAudio('kill'); } 
    else if (!isInHangar) { playAudio('boom'); }

    for(let i=0; i<40; i++) particles.push({ x: this.x, y: this.y, vx: (Math.random()-0.5)*18, vy: (Math.random()-0.5)*18, color: this.color, size: 4, life: 1.0, shape: 'circle' });

    spawnKillLog(this, killer);

    if (killer && isRoundActive) {
      killer.roundKills++; 
      killer.lifeKills++;
      killer.currentStreak++;
      if (killer.currentStreak > killer.maxStreak) killer.maxStreak = killer.currentStreak;
      
      if (killer.currentStreak > userProfile.highestStreak && killer === player) userProfile.highestStreak = killer.currentStreak;

      if (killer === player && !isInHangar) { 
        userProfile.careerKills++;
        
        let isKing = (this === getLeader() && this.roundKills > 0);
        let isRev = (this === revengeTarget);
        let coinsEarned = 15;
        if (isKing) coinsEarned += 35;
        if (isRev) { coinsEarned += 50; revengeTarget = null; }

        userProfile.coins += coinsEarned; saveProfile();

        floatTexts.push({ x: this.x, y: this.y, text: `+${coinsEarned} 🪙`, life: 2.0 });
        showKillBanner(this.name.toUpperCase(), isRev, isKing);
      } else if (this === player && !isInHangar) {
        revengeTarget = killer; 
      }
    }
    
    if (this.currentStreak > userProfile.highestStreak && this === player) userProfile.highestStreak = this.currentStreak;
    this.currentStreak = 0;

    if (this === player) {
      if (isRoundActive && !isVoting && !isInHangar) {
        let m = Math.floor(this.lifeTimer / 60); let s = Math.floor(this.lifeTimer % 60); let tStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
        document.getElementById("death-kills").innerText = this.lifeKills;
        document.getElementById("death-time").innerText = tStr;
        document.getElementById("death-killer-name").innerText = killer ? killer.name : "ENVIRONMENT";
        document.getElementById("death-modal").style.display = "flex";
        sdkGameplayStop(); // death screen = break in gameplay
      }
    } else {
      this.respawnTimer = 1.2; 
    }
  }

  draw(cx, cy) {
    if (!this.alive || (this === player && isInHangar)) return;
    
    if (this.laserTimer > 0) {
      ctx.save(); ctx.translate(this.x - cx, this.y - cy); ctx.rotate(this.angle);
      ctx.shadowBlur = 20; ctx.shadowColor = "#a855f7";
      ctx.strokeStyle = `rgba(168, 85, 247, ${Math.min(1, this.laserTimer * 2)})`;
      ctx.lineWidth = 14 + Math.random() * 6;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(2500, 0); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke();
      ctx.restore();
    }

    ctx.save(); ctx.translate(this.x - cx, this.y - cy); ctx.rotate(this.angle);
    ctx.fillStyle = (this.flashTimer > 0) ? "#ffffff" : this.color; 
    ctx.shadowBlur = 12; ctx.shadowColor = this.color; 
    ctx.beginPath(); this.skinObj.draw(ctx); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(4, 0, 3, 0, Math.PI*2); ctx.fill(); ctx.restore();
    
    let nameY = this.y - cy - 26;
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; 
    
    let displayName = this.name;
    if (this === player && userProfile.equippedBadge) {
      let badgeIcon = "";
      if (userProfile.equippedBadge.startsWith("kills")) {
        let tier = BADGE_TIERS.find(b => `${b.type}-${b.name}` === userProfile.equippedBadge);
        if (tier) badgeIcon = tier.icon + " ";
      } else if (userProfile.equippedBadge.startsWith("wins")) {
        let tier = WIN_TIERS.find(b => `${b.type}-${b.name}` === userProfile.equippedBadge);
        if (tier) badgeIcon = tier.icon + " ";
      } else if (userProfile.equippedBadge.startsWith("streak")) {
        let tier = STREAK_TIERS.find(b => `${b.type}-${b.name}` === userProfile.equippedBadge);
        if (tier) badgeIcon = tier.icon + " ";
      }
      displayName = badgeIcon + displayName;
    } else if (this.isBot && this.botBadge) {
      displayName = this.botBadge + " " + displayName;
    }
    
    ctx.fillText(displayName, this.x-cx, nameY);
    
    let badgeY = nameY - 20;
    if (this === getLeader() && this.roundKills > 0) { ctx.fillStyle = "#fbbf24"; ctx.font = "28px sans-serif"; ctx.fillText("👑", this.x-cx, badgeY); badgeY -= 28; }
    if (this === revengeTarget) { ctx.fillStyle = "#ef4444"; ctx.font = "900 16px sans-serif"; ctx.fillText("🎯 REVENGE", this.x-cx, badgeY); badgeY -= 20; }
    if (this.currentStreak >= 4) { ctx.fillStyle = "#f97316"; ctx.font = "900 16px sans-serif"; ctx.fillText("🔥 STREAK: " + this.currentStreak, this.x-cx, badgeY); badgeY -= 20; }

    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(this.x-cx-18, this.y-cy-18, 36, 5);
    ctx.fillStyle = this.hp > (this.maxHp*0.3) ? "#22c55e" : "#ef4444"; ctx.fillRect(this.x-cx-18, this.y-cy-18, 36*(this.hp/this.maxHp), 5);
  }
}

const player = new Plane(WORLD_WIDTH/2, 800, userProfile.name, false, viewingSkin, userProfile.activeColor, viewingTrail);
const bots = []; const bNames = ["Viper", "Maverick", "Falcon", "Iceman", "Wraith", "Titan", "Spectre", "Zero", "Toxik"];
for (let i=0; i<9; i++) bots.push(new Plane(Math.random()*WORLD_WIDTH, 400+Math.random()*800, bNames[i], true, SKINS[Math.floor(Math.random()*SKINS.length)], COLORS[Math.floor(Math.random()*COLORS.length)], TRAILS[Math.floor(Math.random()*TRAILS.length)]));

function getLeader() {
  const pool = isInHangar ? bots : [player, ...bots];
  return [...pool].sort((a,b)=>b.roundKills-a.roundKills)[0];
}
function updateWeaponUI() { document.getElementById("weapon-badge").innerText = `WEAPON: ${player.weapon} (${player.ammo===Infinity?'∞':player.ammo})`; }

function startIntermission() {
  isRoundActive = false; isVoting = false;
  sdkGameplayStop(); // match over = break in gameplay
  document.getElementById("death-modal").style.display = "none";
  document.getElementById("out-of-bounds-warning").style.display = "none";
  setMusicTheme('voting');
  updateEngineHum(false, false);
  
  const pilots = [player, ...bots].sort((a,b) => b.roundKills - a.roundKills);
  if (pilots[0] === player) { userProfile.careerWins++; }

  // Populate Match Summary Statistics
  document.getElementById("summary-kills").innerText = player.roundKills;
  document.getElementById("summary-streak").innerText = player.maxStreak;

  // XP Calculation
  let startXpPct = (userProfile.xp / getRequiredXP(userProfile.level)) * 100;
  let xpEarned = (player.roundKills * 150) + (pilots[0] === player ? 500 : 100) + Math.floor(player.lifeTimer * 5);
  
  document.getElementById("podium-xp-txt").innerText = `+${xpEarned} XP`;
  document.getElementById("podium-xp-fill").style.width = `${startXpPct}%`;

  addXP(xpEarned);

  let targetXpPct = (userProfile.xp / getRequiredXP(userProfile.level)) * 100;
  setTimeout(() => {
    document.getElementById("podium-xp-fill").style.width = `${targetXpPct}%`;
  }, 200);

  document.getElementById("podium-title").innerText = "MISSION ACCOMPLISHED";
  document.getElementById("podium-display").innerHTML = `
    <div class="pillar silver">
      <h3>2nd</h3>
      <p>${pilots[1].name}</p>
      <div class="pill-kills">⚔️ ${pilots[1].roundKills}</div>
    </div>
    <div class="pillar gold">
      <h3>1st</h3>
      <p>${pilots[0].name}</p>
      <div class="pill-kills">⚔️ ${pilots[0].roundKills}</div>
    </div>
    <div class="pillar bronze">
      <h3>3rd</h3>
      <p>${pilots[2].name}</p>
      <div class="pill-kills">⚔️ ${pilots[2].roundKills}</div>
    </div>
  `;
  let cEarn = 50 + player.roundKills*15 + (pilots[0]===player?100:0); userProfile.coins += cEarn; saveProfile(); buildStore();
  document.getElementById("round-reward-txt").innerText = `+🪙 ${cEarn} Coins Earned!`;
  
  document.getElementById("podium-modal").style.display = "flex";
}

function startVoting() {
  document.getElementById("podium-modal").style.display = "none";
  document.getElementById("voting-modal").style.display = "flex";
  isVoting = true; voteTimer = 15;
  mapVotes = Array(MAPS.length).fill(0); playerMapVote = -1;
  buildVoteUI();
}

function buildVoteUI() {
  const mapG = document.getElementById("map-vote-grid"); mapG.innerHTML = "";
  MAPS.forEach((m, i) => {
    const btn = document.createElement("div"); btn.className = `vote-btn ${playerMapVote===i?'selected':''}`; btn.innerHTML = `${m.name} <div class="vote-count">${mapVotes[i]||0}</div>`;
    btn.onclick = () => { if(playerMapVote===-1) { playerMapVote=i; mapVotes[i]++; buildVoteUI(); } }; mapG.appendChild(btn);
  });
}

function resolveVoting() {
  isVoting = false; document.getElementById("voting-modal").style.display = "none";
  if (mapVotes.length === 0) mapVotes = Array(MAPS.length).fill(0);
  let maxV = Math.max(...mapVotes); let cIdx = mapVotes.indexOf(maxV); currentMapIdx = cIdx !== -1 ? cIdx : 0;
  document.getElementById("map-txt").innerText = MAPS[currentMapIdx].name.toUpperCase();
  startMatch();
}

function drawPointer(target, color, icon, cx, cy) {
  let px = target.x - cx; let py = target.y - cy;
  let midX = canvas.width / 2; let midY = canvas.height / 2;
  let angle = Math.atan2(py - midY, px - midX);
  let cos = Math.cos(angle); let sin = Math.sin(angle); let m = sin / cos;
  
  // Clamped screen edge margins avoiding top bar UI
  let topMargin = 70;
  let margin = 40; 
  let halfW = midX - margin; 
  let halfH = (canvas.height - topMargin) / 2 - margin;
  
  let edgeX, edgeY;
  if (Math.abs(m) > halfH / halfW) { 
    edgeY = sin > 0 ? (canvas.height - margin) : topMargin; 
    edgeX = (edgeY - midY) / m + midX; 
  } else { 
    edgeX = cos > 0 ? (canvas.width - margin) : margin; 
    edgeY = (edgeX - midX) * m + midY; 
  }
  edgeX = Math.max(margin, Math.min(canvas.width - margin, edgeX));
  edgeY = Math.max(topMargin, Math.min(canvas.height - margin, edgeY));

  ctx.save(); ctx.translate(edgeX, edgeY); ctx.rotate(angle);
  ctx.fillStyle = color; ctx.shadowBlur = 10; ctx.shadowColor = color;
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
  ctx.restore();

  if (icon) { ctx.fillStyle = color; ctx.font = "18px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(icon, edgeX - cos * 24, edgeY - sin * 24); }
}

let lastTime = performance.now();
function gameLoop(now) {
  try {
    const dt = Math.min(0.1, (now - lastTime)/1000); lastTime = now;

    // Handle Screen Shake Update
    if (screenShakeTimer > 0) {
      screenShakeTimer -= dt;
      if (screenShakeTimer <= 0) screenShakeIntensity = 0;
    }

    if (isVoting) {
      voteTimer -= dt; document.getElementById("vote-timer-display").innerText = Math.ceil(voteTimer);
      if(Math.random()<0.02) { 
        if (mapVotes.length === 0) mapVotes = Array(MAPS.length).fill(0);
        mapVotes[Math.floor(Math.random()*MAPS.length)]++; buildVoteUI(); 
      }
      if(voteTimer <= 0) resolveVoting();
    }

    if (isRoundActive) {
      roundTimer -= dt; document.getElementById("round-timer").innerText = `${String(Math.floor(roundTimer/60)).padStart(2,'0')}:${String(Math.floor(roundTimer%60)).padStart(2,'0')}`;
      if (roundTimer <= 0) startIntermission();

      if (Math.random() < 0.01 && crates.length < 10) {
        let sx = player.x + (Math.random() - 0.5) * 1500; 
        if (sx < 200) sx = 200; if (sx > WORLD_WIDTH - 200) sx = WORLD_WIDTH - 200;
        let sy = player.y - 800; if (sy < 100) sy = 100;
        crates.push({ x: sx, y: sy, type: ["SHOTGUN", "LASER", "MISSILE", "SHIELD", "PLASMA", "FLAK", "MINES"][Math.floor(Math.random()*7)], vy: 0.8 });
      }

      for (let i = crates.length - 1; i >= 0; i--) {
        let c = crates[i]; c.y += c.vy * 40 * dt; if (c.y >= seaLevel - 20) { crates.splice(i, 1); continue; }
        let collected = false;
        [...bots, ...(isInHangar ? [] : [player])].forEach(p => { 
          if (!collected && p.alive && Math.hypot(p.x - c.x, p.y - c.y) < 35) {
            if (c.type === "SHIELD") { p.hp = p.maxHp; } else { p.weapon = c.type; p.ammo = c.type==="MISSILE"?6:(c.type==="LASER"?1:(c.type==="PLASMA"?8:(c.type==="FLAK"?8:(c.type==="MINES"?4:12)))); }
            if (!p.isBot) updateWeaponUI();
            for (let j=0; j<8; j++) particles.push({ x: c.x, y: c.y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, color: "#38bdf8", size: 4, life: 0.5, shape: 'circle' });
            crates.splice(i, 1); collected = true;
          }
        });
      }
    }

    [player, ...bots].forEach(p => p.update(dt));

    for (let i = bullets.length - 1; i >= 0; i--) {
      let b = bullets[i];
      b.x += b.vx * 60 * dt; b.y += b.vy * 60 * dt; b.life -= dt; if (b.life <= 0 || b.y >= seaLevel) { bullets.splice(i, 1); continue; } 
      
      let hitSomething = false;
      [...bots, ...(isInHangar ? [] : [player])].forEach(p => {
        if (!p.alive || p === b.owner || hitSomething) return;
        let hit = false;
        if (b.type === 'plasma') { if (Math.hypot(p.x-b.x, p.y-b.y) < 40) hit = true; }
        else if (Math.hypot(p.x-b.x, p.y-b.y) < 22) hit = true;

        if (hit) { 
          p.hp -= b.dmg; 
          p.flashTimer = 0.1;
          floatTexts.push({ x: p.x, y: p.y - 20, text: `-${Math.round(b.dmg)}`, life: 0.8 });
          if (p === player) triggerScreenShake(2.5, 0.08);
          if (p.isBot) p.evadeTimer = 2.0; 
          bullets.splice(i, 1); hitSomething = true;  
          if (p.hp <= 0) p.die(b.owner); 
        }
      });
    }

    for (let i = missiles.length - 1; i >= 0; i--) {
      let m = missiles[i]; let t = null, md = 800;
      [...bots, ...(isInHangar ? [] : [player])].forEach(p => { if (!p.alive || p === m.owner) return; let d = Math.hypot(p.x-m.x, p.y-m.y); if (d < md) { md = d; t = p; }});
      if (t) { let wa = Math.atan2(t.y-m.y, t.x-m.x), df = wa-m.angle; while(df<-Math.PI) df+=Math.PI*2; while(df>Math.PI) df-=Math.PI*2; m.angle+=df*4*dt; }
      
      m.x += Math.cos(m.angle) * m.speed * 60 * dt; m.y += Math.sin(m.angle) * m.speed * 60 * dt; m.life -= dt;
      particles.push({ x: m.x, y: m.y, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, color: "#f59e0b", size: 3, life: 0.3, shape: 'circle' });
      
      if (m.life <= 0 || m.y >= seaLevel) { for(let j=0; j<10; j++) particles.push({ x: m.x, y: m.y, vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8, color:"#ef4444", size:4, life:0.5, shape: 'circle' }); missiles.splice(i, 1); continue; }
      
      let exploded = false;
      [...bots, ...(isInHangar ? [] : [player])].forEach(p => { 
        if (!exploded && p.alive && p !== m.owner && Math.hypot(p.x-m.x, p.y-m.y) < 25) { 
          let dmgVal = (m.dmg || 45);
          p.hp -= dmgVal; 
          p.flashTimer = 0.15;
          floatTexts.push({ x: p.x, y: p.y - 25, text: `-${Math.round(dmgVal)}`, life: 1.0 });
          if (p === player) triggerScreenShake(8, 0.2);
          if (p.isBot) p.evadeTimer = 2.0;
          for(let j=0; j<15; j++) particles.push({ x: m.x, y: m.y, vx:(Math.random()-0.5)*10, vy:(Math.random()-0.5)*10, color:"#ef4444", size:4, life:0.6, shape: 'circle' }); 
          
          missiles.splice(i, 1); exploded = true;
          if (p.hp <= 0) {
            p.die(m.owner);
            // Only count it as a missile KILL if this missile actually finished them off
            if (m.owner === player && !isInHangar) {
              userProfile.stats.missileKills++;
              saveProfile();
            }
          }
        }
      });
    }

    for (let i = mines.length - 1; i >= 0; i--) {
      let mn = mines[i]; mn.life -= dt;
      if (mn.life <= 0) { mines.splice(i, 1); continue; }
      let exploded = false;
      [...bots, ...(isInHangar ? [] : [player])].forEach(p => {
        if (!exploded && p.alive && p !== mn.owner && Math.hypot(p.x-mn.x, p.y-mn.y) < 35) {
          let dmgVal = (mn.dmg || 60);
          p.hp -= dmgVal; 
          p.flashTimer = 0.15;
          floatTexts.push({ x: p.x, y: p.y - 25, text: `-${Math.round(dmgVal)}`, life: 1.0 });
          if (p === player) triggerScreenShake(10, 0.25);
          if (p.isBot) p.evadeTimer = 2.0;
          for(let j=0; j<20; j++) particles.push({ x: mn.x, y: mn.y, vx:(Math.random()-0.5)*12, vy:(Math.random()-0.5)*12, color:"#d946ef", size:4, life:0.6, shape: 'circle' });
          mines.splice(i, 1); exploded = true; playAudio('boom'); if (p.hp <= 0) p.die(mn.owner);
        }
      });
    }

    for (let i = particles.length - 1; i >= 0; i--) { let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }

    document.getElementById("hp-bar").style.width = `${Math.max(0, (player.hp/player.maxHp)*100)}%`; 
    document.getElementById("boost-bar").style.width = `${player.boost}%`;
    document.getElementById("coin-txt").innerText = userProfile.coins;
    document.getElementById("match-kills-txt").innerText = String(isInHangar ? savedMatchKills : player.roundKills);

    const ld = [...bots, ...(isInHangar ? [] : [player])].sort((a,b) => b.roundKills - a.roundKills).slice(0,5);
    document.getElementById("lb-entries").innerHTML = ld.map((p,i) => `<div class="lb-row ${p === player ? 'player' : ''}"><span>#${i+1} ${p.name}</span><span>⚔️ ${p.roundKills}</span></div>`).join('');
    
    let leader = getLeader();
    const kingWidget = document.getElementById("king-widget");
    if (leader && leader.roundKills > 0) {
      kingWidget.style.display = "inline-flex";
      const isYou = (!isInHangar && leader === player);
      kingWidget.className = isYou ? "is-you" : "";
      document.getElementById("king-title-txt").innerText = isYou ? "YOU ARE KING:" : "KING:";
      document.getElementById("king-name-txt").innerText = leader.name.toUpperCase();
    } else {
      kingWidget.style.display = "none";
    }

    let camTargetX = (!isInHangar && player.alive) ? player.x : WORLD_WIDTH/2;
    let camTargetY = (!isInHangar && player.alive) ? player.y : 800;
    
    // Apply Screen Shake Offset (Subtle & Clean)
    if (screenShakeTimer > 0 && !isInHangar) {
      camTargetX += (Math.random() - 0.5) * screenShakeIntensity * 4;
      camTargetY += (Math.random() - 0.5) * screenShakeIntensity * 4;
    }

    const cx = camTargetX - canvas.width/2; const cy = Math.max(0, Math.min(WORLD_HEIGHT-canvas.height, camTargetY - canvas.height/2));
    
    render(cx, cy, dt); 
  } catch (err) {
    // Never hide errors! Press F12 → Console in the browser to see them.
    console.error("Game loop error:", err);
  }
  requestAnimationFrame(gameLoop);
}

function render(cx, cy, dt) {
  let safeMapIdx = currentMapIdx >= 0 && currentMapIdx < MAPS.length ? currentMapIdx : 0;
  const map = MAPS[safeMapIdx];
  if (!map) return;
  
  const g = ctx.createLinearGradient(0,0,0,canvas.height); g.addColorStop(0, map.skyTop); g.addColorStop(1, map.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);

  if (map.env === 'clouds') {
    envObjects.forEach(c => {
      if(c.type === 'cloud') { ctx.fillStyle = `rgba(255,255,255,${c.alpha})`; c.x += c.speed; if(c.x>WORLD_WIDTH+300) c.x = -300; ctx.beginPath(); ctx.arc(c.x-cx*0.4, c.y-cy*0.4, c.r, 0, Math.PI*2); ctx.fill(); }
      else if(c.type === 'bird') { ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth=2; c.x -= c.speed; if(c.x<-50) c.x = WORLD_WIDTH+50; ctx.beginPath(); ctx.moveTo(c.x-cx, c.y-cy); ctx.quadraticCurveTo(c.x-cx+5, c.y-cy-5, c.x-cx+10, c.y-cy); ctx.quadraticCurveTo(c.x-cx+15, c.y-cy-5, c.x-cx+20, c.y-cy); ctx.stroke(); }
    });
  } else if (map.env === 'cyber') {
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)"; ctx.lineWidth = 2;
    for(let x = -(cx % 150); x < canvas.width; x += 150) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for(let y = -(cy % 150); y < canvas.height; y += 150) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    ctx.fillStyle = "rgba(34, 197, 94, 0.8)"; ctx.font = "bold 16px monospace";
    envObjects.forEach(c => {
      if (c.type === 'data') { c.y += c.speed; if(c.y > seaLevel) c.y = -100; for(let i=0; i<c.len/15; i++) { ctx.fillText(Math.random()>0.5?"1":"0", c.x-cx, c.y-cy - i*15); } }
      else if (c.type === 'cube') { ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3; c.rot += 0.01; ctx.save(); ctx.translate(c.x-cx*0.5, c.y-cy*0.5); ctx.rotate(c.rot); ctx.strokeRect(-c.size/2, -c.size/2, c.size, c.size); ctx.restore(); }
    });
  } else if (map.env === 'lava') {
    envObjects.forEach(c => {
      if (c.type === 'volcano') { ctx.fillStyle = "#1c1917"; ctx.beginPath(); ctx.moveTo(c.x-cx*0.3, seaLevel-cy); ctx.lineTo(c.x-cx*0.3+c.w/2, seaLevel-cy-c.h); ctx.lineTo(c.x-cx*0.3+c.w, seaLevel-cy); ctx.fill(); ctx.fillStyle = "rgba(239, 68, 68, 0.8)"; ctx.beginPath(); ctx.moveTo(c.x-cx*0.3+c.w/2-30, seaLevel-cy-c.h); ctx.lineTo(c.x-cx*0.3+c.w/2+30, seaLevel-cy-c.h); ctx.lineTo(c.x-cx*0.3+c.w/2, seaLevel-cy-c.h+60); ctx.fill(); }
      else if (c.type === 'rock') { ctx.fillStyle = "#0c0a09"; ctx.beginPath(); ctx.moveTo(c.x-cx, seaLevel-cy); ctx.lineTo(c.x-cx+c.w/2, seaLevel-cy-c.h); ctx.lineTo(c.x-cx+c.w, seaLevel-cy); ctx.fill(); }
      else if (c.type === 'ember') { ctx.fillStyle = "#fbbf24"; c.y += c.speed; c.life -= dt*0.2; if(c.life<=0){ c.y=seaLevel; c.x=Math.random()*WORLD_WIDTH; c.life=1; } ctx.globalAlpha = Math.max(0, c.life); ctx.fillRect(c.x-cx, c.y-cy, 5, 5); ctx.globalAlpha = 1; }
    });
  } else if (map.env === 'snow') {
    ctx.fillStyle = "#ffffff";
    envObjects.forEach(c => { 
      if (c.type === 'iceberg') { ctx.fillStyle = "#0891b2"; ctx.beginPath(); ctx.moveTo(c.x-cx*0.4, seaLevel-cy); ctx.lineTo(c.x-cx*0.4+c.w/2, seaLevel-cy-c.h); ctx.lineTo(c.x-cx*0.4+c.w, seaLevel-cy); ctx.fill(); ctx.fillStyle="#e0f2fe"; ctx.beginPath(); ctx.moveTo(c.x-cx*0.4+20, seaLevel-cy); ctx.lineTo(c.x-cx*0.4+c.w/2, seaLevel-cy-c.h); ctx.lineTo(c.x-cx*0.4+c.w/2+30, seaLevel-cy); ctx.fill(); }
      else { c.x -= c.speedX; c.y += c.speedY; if(c.y > seaLevel || c.x < 0) { c.y = -10; c.x = Math.random()*WORLD_WIDTH; } ctx.globalAlpha = 0.8; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(c.x-cx*0.8, c.y-cy*0.8, c.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; }
    });
  } else if (map.env === 'acid') {
    envObjects.forEach(c => { 
      if (c.type === 'gas') { let radGrad = ctx.createRadialGradient(c.x-cx*0.5, c.y-cy*0.5, 0, c.x-cx*0.5, c.y-cy*0.5, c.r); radGrad.addColorStop(0, `rgba(132, 204, 22, ${c.alpha})`); radGrad.addColorStop(1, "transparent"); ctx.fillStyle = radGrad; ctx.beginPath(); ctx.arc(c.x-cx*0.5, c.y-cy*0.5, c.r, 0, Math.PI*2); ctx.fill(); }
      else if (c.type === 'rain') { c.y += c.speed; if(c.y > seaLevel) c.y = -100; ctx.fillStyle = "rgba(163, 230, 53, 0.6)"; ctx.fillRect(c.x-cx, c.y-cy, 2, 25); }
      else if (c.type === 'barrel') { ctx.fillStyle="#b45309"; ctx.save(); ctx.translate(c.x-cx, c.y-cy); ctx.rotate(c.rot); ctx.fillRect(-12, -18, 24, 36); ctx.restore(); }
    });
  } else if (map.env === 'stars') {
    envObjects.forEach(c => { 
      if (c.type === 'nebula') { let radGrad = ctx.createRadialGradient(c.x-cx*0.1, c.y-cy*0.1, 0, c.x-cx*0.1, c.y-cy*0.1, c.r); radGrad.addColorStop(0, `hsla(${c.hue}, 80%, 50%, 0.2)`); radGrad.addColorStop(1, "transparent"); ctx.fillStyle = radGrad; ctx.beginPath(); ctx.arc(c.x-cx*0.1, c.y-cy*0.1, c.r, 0, Math.PI*2); ctx.fill(); }
      else if (c.type === 'planet') { ctx.fillStyle = `hsl(${c.hue}, 60%, 40%)`; ctx.beginPath(); ctx.arc(c.x-cx*0.2, c.y-cy*0.2, c.r, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = `hsl(${c.hue}, 60%, 80%)`; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(c.x-cx*0.2, c.y-cy*0.2, c.r*1.5, c.r*0.4, 0, 0, Math.PI*2); ctx.stroke(); }
      else if (c.type === 'star') { ctx.fillStyle = "#ffffff"; ctx.globalAlpha = c.alpha; ctx.beginPath(); ctx.arc(c.x-cx*0.05, c.y-cy*0.05, c.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; }
    });
  }

  // Draw Out of Bounds Danger Zones & Borders
  ctx.save();
  ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
  ctx.fillRect(-cx - 5000, -cy - 5000, 5000, seaLevel + 5000); // Left OOB
  ctx.fillRect(WORLD_WIDTH - cx, -cy - 5000, 5000, seaLevel + 5000); // Right OOB
  ctx.fillRect(0 - cx, -cy - 5000, WORLD_WIDTH, 5000); // Top OOB
  
  ctx.strokeStyle = "rgba(239, 68, 68, 0.6)"; 
  ctx.lineWidth = 8;
  ctx.setLineDash([40, 40]);
  ctx.beginPath();
  ctx.moveTo(0 - cx, 0 - cy); ctx.lineTo(WORLD_WIDTH - cx, 0 - cy); // Top border
  ctx.moveTo(0 - cx, 0 - cy); ctx.lineTo(0 - cx, seaLevel - cy); // Left border
  ctx.moveTo(WORLD_WIDTH - cx, 0 - cy); ctx.lineTo(WORLD_WIDTH - cx, seaLevel - cy); // Right border
  ctx.stroke();
  ctx.restore();

  const sY = seaLevel - cy;
  if (sY < canvas.height) {
    ctx.fillStyle = map.sea; ctx.fillRect(0, sY, canvas.width, canvas.height - sY);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,sY); ctx.lineTo(canvas.width,sY); ctx.stroke();
  }

  crates.forEach(c => { 
    ctx.fillStyle = CRATE_COLORS[c.type]; ctx.beginPath(); ctx.arc(c.x-cx, c.y-cy-18, 16, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.x-cx-16, c.y-cy-18); ctx.lineTo(c.x-cx, c.y-cy); ctx.moveTo(c.x-cx+16, c.y-cy-18); ctx.lineTo(c.x-cx, c.y-cy); ctx.stroke();
    ctx.fillStyle="#1e293b"; ctx.fillRect(c.x-cx-14, c.y-cy-10, 28, 20); ctx.strokeStyle=CRATE_COLORS[c.type]; ctx.lineWidth=2; ctx.strokeRect(c.x-cx-14, c.y-cy-10, 28, 20);
    let lbl = c.type==="MISSILE"?"MSL":(c.type==="SHOTGUN"?"SGN":(c.type==="LASER"?"LSR":(c.type==="PLASMA"?"PLM":(c.type==="FLAK"?"FLK":(c.type==="MINES"?"MIN":"SHD")))));
    ctx.fillStyle="#fff"; ctx.font="900 11px sans-serif"; ctx.textAlign="center"; ctx.fillText(lbl, c.x-cx, c.y-cy+4); 
  });

  mines.forEach(mn => {
    ctx.fillStyle = "#d946ef"; ctx.shadowBlur = 10; ctx.shadowColor = "#d946ef";
    ctx.beginPath(); ctx.arc(mn.x-cx, mn.y-cy, 6, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(mn.x-cx, mn.y-cy, 12 + Math.sin(Date.now()*0.005)*4, 0, Math.PI*2); ctx.stroke(); ctx.shadowBlur = 0;
  });

  bullets.forEach(b => {
    if (b.type === 'cannon') { ctx.strokeStyle=b.color; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(b.x-cx, b.y-cy); ctx.lineTo(b.x-cx-b.vx*0.5, b.y-cy-b.vx*0.5); ctx.stroke(); }
    else if (b.type === 'shotgun') { ctx.fillStyle=b.color; ctx.beginPath(); ctx.arc(b.x-cx, b.y-cy, 4, 0, Math.PI*2); ctx.fill(); }
    else if (b.type === 'plasma') { ctx.fillStyle=b.color; ctx.shadowBlur=15; ctx.shadowColor=b.color; ctx.beginPath(); ctx.arc(b.x-cx, b.y-cy, 12, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur=0; }
  });

  missiles.forEach(m => { ctx.save(); ctx.translate(m.x-cx, m.y-cy); ctx.rotate(m.angle); ctx.fillStyle="#fff"; ctx.fillRect(-8,-3,16,6); ctx.fillStyle="#ef4444"; ctx.fillRect(8,-3,4,6); ctx.restore(); });

  player.draw(cx, cy); bots.forEach(b => b.draw(cx, cy));
  
  particles.forEach(p => { 
    ctx.fillStyle=p.color; ctx.globalAlpha = Math.max(0, p.life); 
    if (p.shape === 'star') {
      ctx.beginPath(); let pS = p.size; ctx.moveTo(p.x-cx, p.y-cy-pS); ctx.lineTo(p.x-cx+pS/2, p.y-cy-pS/3); ctx.lineTo(p.x-cx+pS, p.y-cy); ctx.lineTo(p.x-cx+pS/2, p.y-cy+pS/3); ctx.lineTo(p.x-cx, p.y-cy+pS); ctx.lineTo(p.x-cx-pS/2, p.y-cy+pS/3); ctx.lineTo(p.x-cx-pS, p.y-cy); ctx.lineTo(p.x-cx-pS/2, p.y-cy-pS/3); ctx.fill();
    } else if (p.shape === 'square') {
      ctx.fillRect(p.x-cx-p.size/2, p.y-cy-p.size/2, p.size, p.size); 
    } else {
      ctx.beginPath(); ctx.arc(p.x-cx, p.y-cy, p.size, 0, Math.PI*2); ctx.fill(); 
    }
  }); 
  ctx.globalAlpha = 1;

  for (let i = floatTexts.length - 1; i >= 0; i--) { 
    let ft = floatTexts[i]; 
    ft.y -= 25 * dt; 
    ft.life -= dt; 
    ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(1, ft.life)})`; 
    ctx.font = "900 16px sans-serif"; 
    ctx.textAlign = "center"; 
    ctx.fillText(ft.text, ft.x - cx, ft.y - cy); 
    if (ft.life <= 0) floatTexts.splice(i, 1); 
  }

  if (player.alive && isRoundActive && !isInHangar) {
    let enemiesOnScreen = 0; let closestEnemy = null; let minDist = Infinity;
    bots.forEach(b => {
      if (b.alive) {
        let px = b.x - cx; let py = b.y - cy;
        if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) enemiesOnScreen++;
        let d = Math.hypot(b.x - player.x, b.y - player.y);
        if (d < minDist) { minDist = d; closestEnemy = b; }
      }
    });

    if (enemiesOnScreen === 0 && closestEnemy) drawPointer(closestEnemy, "#ef4444", null, cx, cy);
    
    let leader = getLeader();
    if (leader && leader !== player && leader.alive && leader.roundKills > 0) {
      let lx = leader.x - cx; let ly = leader.y - cy;
      if (lx < 0 || lx > canvas.width || ly < 0 || ly > canvas.height) drawPointer(leader, "#fbbf24", "👑", cx, cy);
    }
  }
}

requestAnimationFrame(gameLoop);
