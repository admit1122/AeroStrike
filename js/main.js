// Main game loop (update every frame) and rendering. Loads LAST.

// Screen Shake Engine State
let screenShakeTimer = 0;
let screenShakeIntensity = 0;

function triggerScreenShake(intensity = 5, duration = 0.15) {
  screenShakeIntensity = intensity;
  screenShakeTimer = duration;
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
