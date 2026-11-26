// CrazyGames SDK: init, gameplay events, midgame + rewarded ads

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
