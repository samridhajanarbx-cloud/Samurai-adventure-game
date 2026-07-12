// ============================================================
// bosses.js — the four boss encounters, each with unique patterns
// ============================================================

const BOSS_DEFS = {
  oni: {
    id: 'oni', name: 'Giant Oni', w: 90, h: 120, hp: 600, speed: 110, damage: 22,
    color: '#7a1414', soulReward: 300, coinReward: 200
  },
  shadow_samurai: {
    id: 'shadow_samurai', name: 'Shadow Samurai', w: 46, h: 70, hp: 500, speed: 220, damage: 20,
    color: '#0d0d16', soulReward: 420, coinReward: 300
  },
  dragon_spirit: {
    id: 'dragon_spirit', name: 'Ancient Dragon Spirit', w: 130, h: 90, hp: 850, speed: 180, damage: 26,
    color: '#2b5fa8', soulReward: 600, coinReward: 450, flies: true
  },
  soul_king: {
    id: 'soul_king', name: 'Soul King', w: 60, h: 90, hp: 1200, speed: 200, damage: 30,
    color: '#3d1a5c', soulReward: 1500, coinReward: 1000
  }
};

class Boss {
  constructor(defId, x, y) {
    this.def = BOSS_DEFS[defId];
    this.x = x; this.y = y; this.spawnY = y;
    this.w = this.def.w; this.h = this.def.h;
    this.hp = this.def.hp; this.maxHp = this.def.hp;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.dead = false;
    this.deathTimer = 0;
    this.phase = 1;
    this.attackTimer = 1.0;
    this.currentAttack = null;
    this.attackState = 0;
    this.attackClock = 0;
    this.hurtTimer = 0;
    this.projectiles = [];
    this.introDone = false;
    this.introTimer = 1.6;
    this.telegraphRect = null;
  }

  getHitbox() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }

  takeDamage(amount, particles) {
    if (this.dead || !this.introDone) return;
    this.hp -= amount;
    this.hurtTimer = 0.12;
    particles.spawnHitSpark(this.x, this.y - this.h / 4);
    AUDIO.hit();
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathTimer = 1.0;
      particles.spawnDeathBurst(this.x, this.y, '#ffcc66');
      AUDIO.bossDeath();
    } else if (this.hp < this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2; // enrage: faster attacks handled via attackTimer scale
    }
  }

  update(dt, player, platforms, particles) {
    if (this.dead) { this.deathTimer -= dt; return; }
    if (!this.introDone) {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.introDone = true;
      return;
    }
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.facing = player.x > this.x ? 1 : -1;

    if (!this.def.flies) {
      this.vy += 1500 * dt;
      if (this.vy > 1200) this.vy = 1200;
    } else {
      // gentle hover
      this.y = this.spawnY + Math.sin(performance.now() / 500) * 20;
      this.vy = 0;
    }

    this.attackTimer -= dt;
    const speedMul = this.phase === 2 ? 1.4 : 1;

    if (this.currentAttack) {
      this.runAttack(dt, player, particles, speedMul);
    } else {
      // move toward player, keep some distance for ranged-style bosses
      const d = player.x - this.x;
      const preferredDist = this.def.id === 'dragon_spirit' ? 260 : 90;
      if (Math.abs(d) > preferredDist) {
        this.vx = Math.sign(d) * this.def.speed * speedMul;
      } else {
        this.vx *= 0.8;
      }
      if (this.attackTimer <= 0) {
        this.pickAttack();
        this.attackTimer = randRange(2.2, 3.2) / speedMul;
      }
    }

    this.x += this.vx * dt;
    if (!this.def.flies) {
      this.y += this.vy * dt;
      this.resolveGround(platforms);
    }

    this.projectiles.forEach(p => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (dist(p.x, p.y, player.x, player.y) < 26 && !player.dead && p.life > 0 && !p.hit) {
        player.takeDamage(p.damage, Math.sign(p.vx) * 200);
        p.hit = true;
      }
    });
    this.projectiles = this.projectiles.filter(p => p.life > 0 && !p.hit);
  }

  resolveGround(platforms) {
    this.onGround = false;
    const hb = this.getHitbox();
    for (const p of platforms) {
      if (p.type === 'spike') continue;
      if (!rectsOverlap(hb, p)) continue;
      if (this.vy > 0) { this.y = p.y - this.h / 2; this.vy = 0; this.onGround = true; }
    }
  }

  pickAttack() {
    const id = this.def.id;
    if (id === 'oni') this.currentAttack = Math.random() < 0.5 ? 'slam' : 'charge';
    else if (id === 'shadow_samurai') this.currentAttack = Math.random() < 0.5 ? 'teleport_slash' : 'combo';
    else if (id === 'dragon_spirit') this.currentAttack = Math.random() < 0.5 ? 'firebreath' : 'swoop';
    else this.currentAttack = ['shadowburst', 'combo', 'teleport_slash'][randInt(0, 2)];
    this.attackState = 0;
    this.attackClock = 0;
  }

  runAttack(dt, player, particles, speedMul) {
    this.attackClock += dt;
    const c = this.attackClock;
    switch (this.currentAttack) {
      case 'slam': // Oni: leap up then slam down creating shockwave
        if (c < 0.5) { this.vx *= 0.8; }
        else if (c < 0.7) { this.vy = -650; this.vx = this.facing * 60; }
        else if (this.onGround && c > 0.7) {
          particles.spawnDeathBurst(this.x, this.y + this.h / 2, '#ffaa55');
          AUDIO.bossRoar();
          const shock = { x: this.x - 220, y: this.y + this.h / 2 - 10, w: 440, h: 20 };
          if (rectsOverlap(player.getHitbox(), shock)) player.takeDamage(this.def.damage, (player.x > this.x ? 1 : -1) * 300);
          this.currentAttack = null;
        }
        break;
      case 'charge':
        if (c < 0.4) { this.vx = 0; this.telegraphRect = true; }
        else if (c < 1.1) { this.vx = this.facing * this.def.speed * 3.4 * speedMul; }
        else { this.currentAttack = null; this.telegraphRect = false; }
        if (c > 0.4 && c < 1.1 && rectsOverlap(this.getHitbox(), player.getHitbox()) && !player.dead) {
          player.takeDamage(this.def.damage, this.facing * 340);
        }
        break;
      case 'teleport_slash':
        if (c < 0.3) { this.vx = 0; }
        else if (c < 0.32) {
          this.x = player.x - this.facing * 70;
          particles.spawnDust(this.x, this.y);
        } else if (c < 0.6) {
          if (c > 0.5 && rectsOverlap(this.getHitbox(), player.getHitbox())) player.takeDamage(this.def.damage, this.facing * 260);
        } else { this.currentAttack = null; }
        break;
      case 'combo':
        if (c < 1.6) {
          this.vx = Math.sign(player.x - this.x) * this.def.speed * 1.6 * speedMul;
          if (Math.floor(c * 4) % 2 === 0 && dist(this.x, this.y, player.x, player.y) < 70 && !player.dead) {
            player.takeDamage(this.def.damage * 0.5, this.facing * 200);
          }
        } else { this.currentAttack = null; }
        break;
      case 'firebreath':
        if (c < 0.4) { this.vx = 0; }
        else if (c < 1.4) {
          if (Math.floor(c * 10) % 2 === 0) {
            this.projectiles.push({ x: this.x + this.facing * 50, y: this.y, vx: this.facing * 420, vy: randRange(-40, 40), life: 1.2, damage: this.def.damage * 0.6 });
          }
        } else { this.currentAttack = null; }
        break;
      case 'swoop':
        if (c < 0.4) { this.vx = 0; }
        else if (c < 1.2) { this.vx = Math.sign(player.x - this.x) * this.def.speed * 3 * speedMul; this.y = this.spawnY + Math.sin(c * 20) * 10; }
        else { this.currentAttack = null; }
        if (c > 0.4 && c < 1.2 && rectsOverlap(this.getHitbox(), player.getHitbox())) player.takeDamage(this.def.damage, this.facing * 300);
        break;
      case 'shadowburst':
        if (c < 0.5) { this.vx = 0; }
        else if (c < 0.55) {
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            this.projectiles.push({ x: this.x, y: this.y, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, life: 1.4, damage: this.def.damage * 0.5 });
          }
          AUDIO.bossRoar();
        } else if (c > 1.0) { this.currentAttack = null; }
        break;
    }
  }

  draw(ctx, camX, camY) {
    if (!this.introDone && this.introTimer > 0) {
      // still draw faint silhouette while intro plays
    }
    const sx = this.x - camX, sy = this.y - camY;
    ctx.save();
    if (this.dead) ctx.globalAlpha = clamp(this.deathTimer, 0, 1);
    if (this.hurtTimer > 0) ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.55);

    ctx.translate(sx, sy);
    ctx.scale(this.facing, 1);
    ctx.fillStyle = this.def.color;
    roundRectPath(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 10);
    ctx.fill();
    ctx.fillStyle = '#ff2b2b';
    ctx.beginPath(); ctx.arc(this.w / 2 - 18, -this.h / 2 + 20, 6, 0, Math.PI * 2); ctx.fill();

    if (this.currentAttack === 'charge' && this.telegraphRect) {
      ctx.fillStyle = 'rgba(255,60,60,0.3)';
      ctx.fillRect(this.w / 2, -this.h / 2, 400, this.h);
    }
    ctx.restore();

    this.projectiles.forEach(p => {
      const px = p.x - camX, py = p.y - camY;
      ctx.fillStyle = this.def.id === 'dragon_spirit' ? '#ff7a30' : '#7d2bff';
      ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
    });
  }
}
