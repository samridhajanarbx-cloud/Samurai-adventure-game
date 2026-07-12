// ============================================================
// particles.js — visual effects: slashes, souls, hit sparks, weather
// ============================================================

class Particle {
  constructor(x, y, vx, vy, life, color, size, gravity = 0, shape = 'circle') {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size;
    this.gravity = gravity;
    this.shape = shape;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx, camX, camY) {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    const sx = this.x - camX, sy = this.y - camY;
    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(sx, sy, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(sx - this.size / 2, sy - this.size / 2, this.size, this.size);
    }
    ctx.restore();
  }
}

// A soul/coin "pickup" that flies toward the player once spawned
class Pickup {
  constructor(x, y, type, value) {
    this.x = x; this.y = y; this.type = type; // 'soul' | 'coin'
    this.value = value;
    this.vy = -randRange(120, 200);
    this.vx = randRange(-60, 60);
    this.settleTimer = 0.35;
    this.collected = false;
    this.age = 0;
  }
  update(dt, player) {
    this.age += dt;
    if (this.settleTimer > 0) {
      this.settleTimer -= dt;
      this.vy += 500 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else {
      // home in on the player
      const d = dist(this.x, this.y, player.x, player.y);
      const speed = clamp(700 - d, 260, 700);
      const ang = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(ang) * speed * dt;
      this.y += Math.sin(ang) * speed * dt;
      if (d < 28) this.collected = true;
    }
  }
  draw(ctx, camX, camY) {
    const sx = this.x - camX, sy = this.y - camY;
    const bob = Math.sin(this.age * 6) * 3;
    ctx.save();
    if (this.type === 'soul') {
      const grad = ctx.createRadialGradient(sx, sy + bob, 0, sx, sy + bob, 10);
      grad.addColorStop(0, '#c9f7ff');
      grad.addColorStop(1, 'rgba(80,180,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy + bob, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eafcff';
      ctx.beginPath(); ctx.arc(sx, sy + bob, 4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#8a6300';
      ctx.beginPath(); ctx.arc(sx, sy + bob, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() { this.particles = []; this.pickups = []; }

  update(dt, player, onCollect) {
    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.dead);
    this.pickups.forEach(p => p.update(dt, player));
    this.pickups.forEach(p => { if (p.collected) onCollect(p); });
    this.pickups = this.pickups.filter(p => !p.collected);
  }

  draw(ctx, camX, camY) {
    this.particles.forEach(p => p.draw(ctx, camX, camY));
    this.pickups.forEach(p => p.draw(ctx, camX, camY));
  }

  spawnSlash(x, y, facing) {
    for (let i = 0; i < 6; i++) {
      this.particles.push(new Particle(
        x, y, facing * randRange(150, 350), randRange(-80, 80),
        0.18, '#fff6d9', randRange(2, 4), 0
      ));
    }
  }

  spawnHitSpark(x, y) {
    for (let i = 0; i < 8; i++) {
      const ang = randRange(0, Math.PI * 2);
      this.particles.push(new Particle(
        x, y, Math.cos(ang) * randRange(60, 220), Math.sin(ang) * randRange(60, 220),
        0.35, '#ff5544', randRange(2, 3), 300
      ));
    }
  }

  spawnDeathBurst(x, y, color = '#ffffff') {
    for (let i = 0; i < 16; i++) {
      const ang = randRange(0, Math.PI * 2);
      this.particles.push(new Particle(
        x, y, Math.cos(ang) * randRange(40, 260), Math.sin(ang) * randRange(40, 260),
        0.5, color, randRange(2, 5), 250
      ));
    }
  }

  spawnDust(x, y) {
    for (let i = 0; i < 4; i++) {
      this.particles.push(new Particle(
        x, y, randRange(-40, 40), randRange(-60, -10),
        0.3, 'rgba(200,200,200,0.5)', randRange(3, 6), 200
      ));
    }
  }

  addSoulPickup(x, y, value) { this.pickups.push(new Pickup(x, y, 'soul', value)); }
  addCoinPickup(x, y, value) { this.pickups.push(new Pickup(x, y, 'coin', value)); }
}
