// ============================================================
// audio.js — lightweight synthesized audio engine (WebAudio API)
// No external sound files are needed; all SFX/music are generated.
// ============================================================

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicNodes = [];
    this.currentTrack = null;
    this.enabled = true;
  }

  // Must be called after a user gesture (browser autoplay policy)
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.35;
    this.sfxGain.connect(this.ctx.destination);
  }

  tone(freq, duration, type = 'sine', gainVal = 0.3, destination = null) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(destination || this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  noiseBurst(duration, gainVal = 0.3) {
    if (!this.ctx || !this.enabled) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = gainVal;
    src.connect(gain);
    gain.connect(this.sfxGain);
    src.start();
  }

  // ---- specific SFX ----
  slash() { this.noiseBurst(0.12, 0.25); this.tone(randRange(700, 1000), 0.08, 'sawtooth', 0.15); }
  hit() { this.tone(120, 0.15, 'square', 0.25); }
  enemyDeath() { this.tone(200, 0.3, 'sawtooth', 0.2); this.tone(90, 0.4, 'sine', 0.2); }
  coin() { this.tone(1200, 0.08, 'square', 0.15); this.tone(1600, 0.1, 'square', 0.12); }
  soul() { this.tone(500, 0.25, 'sine', 0.15); this.tone(800, 0.3, 'sine', 0.1); }
  jump() { this.tone(400, 0.12, 'triangle', 0.15); }
  dash() { this.tone(900, 0.1, 'sawtooth', 0.15); }
  hurt() { this.tone(90, 0.25, 'square', 0.3); }
  levelFeel() { this.tone(660, 0.4, 'sine', 0.2); this.tone(880, 0.5, 'sine', 0.15); }
  bossRoar() { this.tone(70, 0.8, 'sawtooth', 0.35); this.tone(50, 1.0, 'square', 0.25); }
  purchase() { this.tone(660, 0.1, 'square', 0.2); this.tone(990, 0.15, 'square', 0.15); }
  bossDeath() {
    [80, 65, 50, 35].forEach((f, i) => setTimeout(() => this.tone(f, 0.6, 'sawtooth', 0.3), i * 150));
  }

  // ---- ambient background music (procedural drone + arpeggio) ----
  startMusic(mood = 'explore') {
    this.stopMusic();
    if (!this.ctx) return;
    this.currentTrack = mood;
    const baseFreqs = mood === 'boss' ? [55, 65, 82] : [110, 146, 165, 196];
    const interval = mood === 'boss' ? 260 : 650;
    let i = 0;
    const playStep = () => {
      if (this.currentTrack !== mood) return;
      const f = baseFreqs[i % baseFreqs.length];
      this.tone(f, interval / 1000 + 0.1, mood === 'boss' ? 'sawtooth' : 'triangle', mood === 'boss' ? 0.06 : 0.05, this.musicGain);
      i++;
      this.musicTimeout = setTimeout(playStep, interval);
    };
    playStep();
  }

  stopMusic() {
    this.currentTrack = null;
    if (this.musicTimeout) clearTimeout(this.musicTimeout);
  }
}

const AUDIO = new AudioSystem();
