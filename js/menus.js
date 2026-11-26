// Settings and badges menus

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
