// ============================================================
// game.js — main loop: state machine, camera, rendering, combat glue
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GameState = {
  MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', SHOP: 'shop', DEAD: 'dead'
};

class Game {
  constructor() {
    this.state = GameState.MENU;
    this.world = new World();
    this.player = new Player(150, GROUND_BASE_Y - 100);
    this.particles = new ParticleSystem();
    this.enemies = [];
    this.boss = null;
    this.cam = { x: 0, y: 0 };
    this.dayNight = 0; // 0..1 cycles
    this.lastTime = performance.now();
    this.weatherParticles = [];
    this.checkpoints = this.buildCheckpoints();

    this.bindUI();
    this.resetEnemiesFromWorld();
    requestAnimationFrame(this.loop.bind(this));
  }

  buildCheckpoints() {
    // one checkpoint (shrine) near the start of each zone
    return ZONES.map(z => ({ x: z.xStart + 120, y: GROUND_BASE_Y - 100, zone: z.key }));
  }

  resetEnemiesFromWorld() {
    this.enemies = [];
  }

  // ---------------- UI bindings ----------------
  bindUI() {
    document.getElementById('newGameBtn').onclick = () => { AUDIO.init(); this.newGame(); };
    document.getElementById('continueBtn').onclick = () => { AUDIO.init(); this.continueGame(); };
    document.getElementById('resumeBtn').onclick = () => this.setState(GameState.PLAYING);
    document.getElementById('saveBtn').onclick = () => { saveGame(this.player); this.flashPrompt('Game Saved'); };
    document.getElementById('shopFromPauseBtn').onclick = () => this.openShop();
    document.getElementById('closeShopBtn').onclick = () => this.setState(GameState.PAUSED);
    document.getElementById('restartBtn').onclick = () => { clearSaveGame(); this.newGame(); };
    document.getElementById('respawnBtn').onclick = () => {
      this.player.respawn();
      this.setState(GameState.PLAYING);
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === GameState.PLAYING) this.setState(GameState.PAUSED);
        else if (this.state === GameState.PAUSED) this.setState(GameState.PLAYING);
      }
      if (e.code === 'KeyB' && this.state === GameState.PLAYING) this.openShop();
    });
  }

  newGame() {
    this.player = new Player(150, GROUND_BASE_Y - 100);
    this.world = new World();
    this.enemies = [];
    this.boss = null;
    clearSaveGame();
    UI.els.continueBtn.style.display = 'none';
    this.setState(GameState.PLAYING);
    AUDIO.startMusic('explore');
  }

  continueGame() {
    loadGame(this.player);
    this.setState(GameState.PLAYING);
    AUDIO.startMusic('explore');
  }

  openShop() {
    this.setState(GameState.SHOP);
    const buy = (id) => {
      if (this.player.buyWeapon(id)) this.flashPrompt('Purchased!');
      UI.renderShop(this.player, buy, equip);
    };
    const equip = (id) => {
      this.player.equipWeapon(id);
      UI.renderShop(this.player, buy, equip);
    };
    UI.renderShop(this.player, buy, equip);
  }

  setState(s) {
    this.state = s;
    if (s === GameState.MENU) UI.showScreen('startScreen');
    else if (s === GameState.PAUSED) UI.showScreen('pauseScreen');
    else if (s === GameState.SHOP) UI.showScreen('shopScreen');
    else if (s === GameState.DEAD) UI.showScreen('deathScreen');
    else UI.showScreen(null);
  }

  flashPrompt(text) {
    UI.showPrompt(text);
    clearTimeout(this._promptTimeout);
    this._promptTimeout = setTimeout(() => UI.hidePrompt(), 1500);
  }

  // ---------------- main loop ----------------
  loop(now) {
    let dt = (now - this.lastTime) / 1000;
    dt = Math.min(dt, 0.05);
    this.lastTime = now;

    if (this.state === GameState.PLAYING) this.update(dt);
    this.render();

    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt) {
    const p = this.player;
    const solids = this.world.getAllSolids();

    this.world.updateMovingPlatforms(dt);
    p.update(dt, solids, this.particles);

    if (p.dead && this.state !== GameState.DEAD) {
      this.setState(GameState.DEAD);
    }
    if (!p.dead && this.state === GameState.DEAD) {
      this.setState(GameState.PLAYING);
    }

    // ---- checkpoint update ----
    const zone = getZoneAt(p.x);
    UI.showZoneBanner(zone.name);
    const cp = this.checkpoints.find(c => c.zone === zone.key);
    if (cp && Math.abs(p.checkpoint.x - cp.x) > 1 && p.x > cp.x - 40) {
      p.setCheckpoint(cp.x, cp.y, zone.key);
    }

    // ---- enemy spawn/despawn near camera ----
    this.updateEnemySpawns();
    this.enemies.forEach(e => e.update(dt, p, solids, this.particles));
    this.enemies = this.enemies.filter(e => !(e.dead && e.deathTimer <= 0));

    // ---- boss triggers ----
    if (!this.boss) {
      for (const bt of this.world.bossTriggers) {
        if (!bt.spawned && !p.defeatedBosses.includes(bt.bossId) && p.x > bt.x - 60) {
          bt.spawned = true;
          this.boss = new Boss(bt.bossId, bt.x + 200, GROUND_BASE_Y - 150);
          AUDIO.startMusic('boss');
          AUDIO.bossRoar();
        }
      }
    }
    if (this.boss) {
      this.boss.update(dt, p, solids, this.particles);
      UI.updateBossBar(this.boss);
      if (this.boss.dead && this.boss.deathTimer <= 0) {
        if (!p.defeatedBosses.includes(this.boss.def.id)) {
          p.defeatedBosses.push(this.boss.def.id);
          p.addSouls(this.boss.def.soulReward);
          p.addCoins(this.boss.def.coinReward);
          this.flashPrompt(`${this.boss.def.name} defeated! +${this.boss.def.soulReward} souls, +${this.boss.def.coinReward} coins`);
          saveGame(p);
          if (this.boss.def.id === 'soul_king') this.flashPrompt('You have become the Soul Samurai. Thank you for playing!');
        }
        this.boss = null;
        AUDIO.startMusic('explore');
      }
    } else {
      UI.updateBossBar(null);
    }

    // ---- combat resolution: player attack hits enemies/boss ----
    if (p._justAttacked) this.resolvePlayerAttack();

    // ---- particles / pickups ----
    this.particles.update(dt, p, (pickup) => {
      if (pickup.type === 'soul') { p.addSouls(pickup.value); AUDIO.soul(); }
      else { p.addCoins(pickup.value); AUDIO.coin(); }
    });

    // ---- day/night cycle ----
    this.dayNight += dt * 0.01;
    if (this.dayNight > 1) this.dayNight -= 1;

    // ---- weather particles ----
    this.updateWeather(dt, zone);

    // ---- camera ----
    this.cam.x = clamp(p.x - canvas.width / 2, 0, WORLD_WIDTH - canvas.width);
    const targetCamY = clamp(p.y - canvas.height / 2, -400, 0);
    this.cam.y += (targetCamY - this.cam.y) * Math.min(1, dt * 4);
  }

  resolvePlayerAttack() {
    const p = this.player;
    const hb = p.getAttackHitbox();
    const w = p.getWeapon();
    let hitSomething = false;

    this.enemies.forEach(e => {
      if (e.dead) return;
      if (rectsOverlap(hb, e.getHitbox())) {
        let dmg = p.getTotalDamage();
        let isCrit = false;
        if (w.special === 'crit' && Math.random() < 0.15) { dmg *= 2; isCrit = true; }
        if (w.special === 'execute' && e.hp / e.maxHp < 0.12) dmg = e.hp + 999;
        e.takeDamage(dmg, p.facing * 260, this.particles);
        if (w.special === 'lifesteal') p.heal(dmg * 0.15);
        if (w.special === 'fire') e._burning = 8; // flag; simple DOT could be added, kept lightweight
        hitSomething = true;
        if (e.dead) {
          const soulAmt = randInt(e.def.soulDrop[0], e.def.soulDrop[1]);
          const coinAmt = randInt(e.def.coinDrop[0], e.def.coinDrop[1]);
          this.particles.addSoulPickup(e.x, e.y, soulAmt);
          this.particles.addCoinPickup(e.x + 10, e.y, coinAmt);
        }
      }
    });

    if (this.boss && !this.boss.dead && this.boss.introDone && rectsOverlap(hb, this.boss.getHitbox())) {
      let dmg = p.getTotalDamage();
      if (w.special === 'crit' && Math.random() < 0.15) dmg *= 2;
      if (w.special === 'execute' && this.boss.hp / this.boss.maxHp < 0.12) dmg = this.boss.hp + 999;
      this.boss.takeDamage(dmg, this.particles);
      if (w.special === 'lifesteal') p.heal(dmg * 0.15);
      hitSomething = true;
    }
  }

  updateEnemySpawns() {
    const camLeft = this.cam.x - 200;
    const camRight = this.cam.x + canvas.width + 200;
    this.world.spawnPoints.forEach(sp => {
      const inView = sp.x > camLeft && sp.x < camRight;
      if (inView && !sp.alive) {
        // respawn cooldown check
        if (sp.respawnTimer <= 0) {
          const e = new Enemy(sp.type, sp.x, sp.y, sp.id);
          e._spawnRef = sp;
          this.enemies.push(e);
          sp.alive = true;
        }
      }
    });
    // detect deaths to restart respawn timers
    this.world.spawnPoints.forEach(sp => {
      const stillTracked = this.enemies.find(e => e._spawnRef === sp);
      if (sp.alive && (!stillTracked || (stillTracked.dead && stillTracked.deathTimer <= 0))) {
        sp.alive = false;
        sp.respawnTimer = 18; // seconds before this point can spawn again
      }
    });
    this.world.spawnPoints.forEach(sp => { if (sp.respawnTimer > 0) sp.respawnTimer -= 1 / 60; });
  }

  updateWeather(dt, zone) {
    if (zone.weather === 'rain') {
      for (let i = 0; i < 3; i++) {
        this.weatherParticles.push({ x: this.cam.x + Math.random() * canvas.width, y: this.cam.y - 20, vy: 900, type: 'rain' });
      }
    } else if (zone.weather === 'wind') {
      if (Math.random() < 0.1) this.weatherParticles.push({ x: this.cam.x - 20, y: this.cam.y + Math.random() * canvas.height, vy: 0, vx: 400, type: 'wind' });
    }
    this.weatherParticles.forEach(wp => {
      wp.y += (wp.vy || 0) * dt;
      wp.x += (wp.vx || 0) * dt;
    });
    this.weatherParticles = this.weatherParticles.filter(wp => wp.y < this.cam.y + canvas.height + 40 && wp.x < this.cam.x + canvas.width + 60);
  }

  // ---------------- rendering ----------------
  render() {
    const zone = getZoneAt(this.player.x + 100);
    this.drawBackground(zone);

    ctx.save();
    // world objects
    this.drawPlatforms();
    this.enemies.forEach(e => e.draw(ctx, this.cam.x, this.cam.y));
    if (this.boss) this.boss.draw(ctx, this.cam.x, this.cam.y);
    this.player.draw(ctx, this.cam.x, this.cam.y);
    this.particles.draw(ctx, this.cam.x, this.cam.y);
    this.drawWeather(zone);
    ctx.restore();

    this.drawDayNightOverlay();

    if (this.state === GameState.PLAYING) UI.updateHUD(this.player);
  }

  drawBackground(zone) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, zone.sky[0]);
    grad.addColorStop(1, zone.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // simple parallax silhouette hills
    ctx.fillStyle = zone.accent;
    ctx.globalAlpha = 0.5;
    const parX = -this.cam.x * 0.3;
    for (let i = 0; i < 6; i++) {
      const bx = (i * 400 + (parX % 2400));
      ctx.beginPath();
      ctx.ellipse(bx, canvas.height - 40, 260, 140, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawPlatforms() {
    const solids = this.world.getAllSolids();
    solids.forEach(p => {
      const sx = p.x - this.cam.x, sy = p.y - this.cam.y;
      if (sx + p.w < -50 || sx > canvas.width + 50) return;
      if (p.type === 'spike') {
        ctx.fillStyle = '#c9c9c9';
        for (let i = 0; i < p.w; i += 10) {
          ctx.beginPath();
          ctx.moveTo(sx + i, sy + p.h);
          ctx.lineTo(sx + i + 5, sy);
          ctx.lineTo(sx + i + 10, sy + p.h);
          ctx.fill();
        }
      } else if (p.type === 'wall') {
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(sx, sy, p.w, p.h);
      } else {
        ctx.fillStyle = p.type === 'platform' ? '#5a4632' : '#2f2a24';
        ctx.fillRect(sx, sy, p.w, p.h);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(sx, sy, p.w, 4);
      }
    });

    // boss trigger markers (torches) — purely visual cue
    this.world.bossTriggers.forEach(bt => {
      if (bt.spawned) return;
      const sx = bt.x - this.cam.x, sy = GROUND_BASE_Y - this.cam.y;
      if (sx < -50 || sx > canvas.width + 50) return;
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath(); ctx.arc(sx, sy - 60, 6 + Math.sin(performance.now() / 150) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(sx - 3, sy - 55, 6, 55);
    });
  }

  drawWeather(zone) {
    this.weatherParticles.forEach(wp => {
      const sx = wp.x - this.cam.x, sy = wp.y - this.cam.y;
      if (wp.type === 'rain') {
        ctx.strokeStyle = 'rgba(180,200,255,0.5)';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 4, sy + 16); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 24, sy); ctx.stroke();
      }
    });
    if (zone.weather === 'fog') {
      ctx.fillStyle = 'rgba(200,200,220,0.08)';
      ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
    }
  }

  drawDayNightOverlay() {
    // brightness curve: bright at 0.25 (noon), dark at 0.75 (midnight)
    const t = this.dayNight;
    const darkness = 0.5 - 0.5 * Math.cos(t * Math.PI * 2); // 0 = noon, 1 = midnight
    const alpha = darkness * 0.55;
    if (alpha > 0.02) {
      ctx.fillStyle = `rgba(10,10,40,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
}

let GAME;
window.addEventListener('load', () => {
  UI.init();
  GAME = new Game();
  UI.showScreen('startScreen');
});
