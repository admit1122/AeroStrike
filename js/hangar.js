// Hangar + match flow: kill banners, store, launch, respawn, menu, leaderboards

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
