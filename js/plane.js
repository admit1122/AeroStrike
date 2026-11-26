// The Plane class: movement, bot AI, weapons, dying, drawing

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
