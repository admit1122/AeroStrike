// Sound: Web Audio engine hum, sound effects, background music

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
