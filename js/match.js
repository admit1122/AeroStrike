// Player + bots, end of match podium, map voting, off-screen pointers

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
