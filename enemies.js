// ============================================================
// enemies.js — regular enemy types & their AI
// ============================================================

const ENEMY_TYPES = {
  bandit: {
    name: 'Bandit', w: 30, h: 50, hp: 40, speed: 140, damage: 10,
    color: '#8a5a2b', detectRange: 320, attackRange: 46, attackCooldown: 1.1,
    soulDrop: [4, 8], coinDrop: [2, 6]
  },
  ninja: {
    name: 'Ninja', w: 26, h: 46, hp: 30, speed: 240, damage: 8,
    color: '#2b2b3a', detectRange: 380, attackRange: 42, attackCooldown: 0.8,
    soulDrop: [6, 10], coinDrop: [3, 7], dashAttack: true
  },
  skeleton: {
    name: 'Skeleton Warrior', w: 32, h: 52, hp: 70, speed: 90, damage: 14,
    color: '#d8d8c8', detectRange: 260, attackRange: 50, attackCooldown: 1.4,
    soulDrop: [8, 14], coinDrop: [4, 9]
  },
  corrupted_samurai: {
    name: 'Corrupted Samurai', w: 32, h: 54, hp: 90, speed: 160, damage: 18,
    color: '#4a1030', detectRange: 340, attackRange: 54, attackCooldown: 1.0,
    soulDrop: [12, 20], coinDrop: [8, 16], blockChance: 0.25
  },
  shadow_beast: {
    name: 'Shadow Beast', w: 40, h: 34, hp: 55, speed: 260, damage: 12,
    color: '#160018', detectRange: 420, attackRange: 44, attackCooldown: 0.7,
    soulDrop: [10, 16], coinDrop: [5, 10], erratic: true
  }
};

let ENEMY_ID = 0;

class Enemy {
  constructor(typeKey, x, y, spawnPointId) {
    this.typeKey = typeKey;
    this.def = ENEMY_TYPES[typeKey];
    this.id = ENEMY_ID++;
    this.spawnPointId = spawnPointId;
    this.x = x; this.y = y;
    this.spawnX = x; this.spawnY = y;
    this.w = this.def.w; this.h = this.def.h;
    this.hp = this.def.hp; this.maxHp = this.def.hp;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.state = 'patrol'; // patrol, chase, attack, hurt, dead
    this.attackTimer = 0;
    this.hurtTimer = 0;
    this.deathTimer = 0;
    this.onGround = false;
    this.patrolDir = Math.random() < 0.5 ? -1 : 1;
    this.patrolTimer = randRange(1, 3);
    this.dead = false;
    this.erraticTimer = 0;
    this.telegraph = 0; // visual wind-up before attack lands
  }

  getHitbox() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }

  takeDamage(amount, knockX, particles) {
    if (this.dead) return;
    this.hp -= amount;
    this.hurtTimer = 0.15;
    this.vx = knockX;
    this.vy = -160;
    particles.spawnHitSpark(this.x, this.y - this.h / 4);
    AUDIO.hit();
    if (this.hp <= 0) this.die(particles);
  }

  die(particles) {
    this.dead = true;
    this.deathTimer = 0.4;
    particles.spawnDeathBurst(this.x, this.y, '#ffffff');
    AUDIO.enemyDeath();
  }

  update(dt, player, platforms, particles) {
    if (this.dead) { this.deathTimer -= dt; return; }
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    // burning damage-over-time (applied by the Dragon Katana's fire special)
    if (this._burning > 0) {
      this._burnTick = (this._burnTick || 0) + dt;
      this._burning -= dt;
      if (this._burnTick >= 0.5) {
        this._burnTick = 0;
        this.hp -= 3;
        particles.spawnHitSpark(this.x, this.y - this.h / 3);
        if (this.hp <= 0) this.die(particles);
      }
    }

    const gravity = 1500;
    this.vy += gravity * dt;
    if (this.vy > 1200) this.vy = 1200;

    const d = dist(this.x, this.y, player.x, player.y);
    const canSeePlayer = d < this.def.detectRange && !player.dead;

    if (this.hurtTimer <= 0) {
      if (canSeePlayer) {
        this.state = d < this.def.attackRange ? 'attack' : 'chase';
      } else if (this.state !== 'patrol') {
        this.state = 'patrol';
      }
    }

    if (this.hurtTimer > 0) {
      this.vx *= 0.9;
    } else if (this.state === 'chase') {
      const dir = player.x > this.x ? 1 : -1;
      this.facing = dir;
      let spd = this.def.speed;
      if (this.def.erratic) {
        this.erraticTimer -= dt;
        if (this.erraticTimer <= 0) { this.erraticTimer = randRange(0.3, 0.8); }
        spd *= (0.7 + Math.sin(this.erraticTimer * 10) * 0.3);
      }
      this.vx = dir * spd;
    } else if (this.state === 'attack') {
      this.facing = player.x > this.x ? 1 : -1;
      this.vx *= 0.7;
      if (this.attackTimer <= 0) {
        this.telegraph = 0.28;
        this.attackTimer = this.def.attackCooldown;
        setTimeout(() => {}, 0);
        this._pendingHit = true;
      }
    } else { // patrol
      this.patrolTimer -= dt;
      if (this.patrolTimer <= 0) {
        this.patrolDir *= -1;
        this.patrolTimer = randRange(1.5, 3.5);
      }
      this.vx = this.patrolDir * this.def.speed * 0.35;
      this.facing = this.patrolDir;
    }

    if (this.telegraph > 0) {
      this.telegraph -= dt;
      if (this.telegraph <= 0 && this._pendingHit) {
        this._pendingHit = false;
        if (dist(this.x, this.y, player.x, player.y) < this.def.attackRange + 14 && !player.dead) {
          if (!(this.def.blockChance && Math.random() < 0.001)) {
            player.takeDamage(this.def.damage, (player.x > this.x ? 1 : -1) * 240);
          }
        }
      }
    }

    // integrate + collide
    this.x += this.vx * dt;
    this.resolveCollisions(platforms, 'x');
    this.y += this.vy * dt;
    this.onGround = false;
    this.resolveCollisions(platforms, 'y');

    // avoid walking off ledges while patrolling (simple ground-ahead check)
    if (this.state === 'patrol' && this.onGround) {
      const aheadX = this.x + this.facing * this.w;
      let groundAhead = false;
      for (const p of platforms) {
        if (p.type === 'spike') continue;
        if (aheadX > p.x && aheadX < p.x + p.w && Math.abs((this.y + this.h / 2) - p.y) < 30) { groundAhead = true; break; }
      }
      if (!groundAhead) this.patrolDir *= -1;
    }
  }

  resolveCollisions(platforms, axis) {
    const hb = this.getHitbox();
    for (const p of platforms) {
      if (p.type === 'spike') continue;
      if (!rectsOverlap(hb, p)) continue;
      if (axis === 'x') {
        if (this.vx > 0) this.x = p.x - this.w / 2;
        else if (this.vx < 0) this.x = p.x + p.w + this.w / 2;
      } else {
        if (this.vy > 0) { this.y = p.y - this.h / 2; this.vy = 0; this.onGround = true; }
        else if (this.vy < 0) { this.y = p.y + p.h + this.h / 2; this.vy = 0; }
      }
      const hb2 = this.getHitbox();
      hb.x = hb2.x; hb.y = hb2.y;
    }
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX, sy = this.y - camY;
    ctx.save();
    if (this.dead) ctx.globalAlpha = clamp(this.deathTimer / 0.4, 0, 1);
    if (this.hurtTimer > 0) ctx.globalAlpha = 0.6;

    ctx.translate(sx, sy);
    ctx.scale(this.facing, 1);

    ctx.fillStyle = this.def.color;
    roundRectPath(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 6);
    ctx.fill();

    // eyes
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(this.w / 2 - 12, -this.h / 2 + 12, 4, 4);

    // telegraph flash before attack
    if (this.telegraph > 0) {
      ctx.fillStyle = 'rgba(255,80,80,0.35)';
      ctx.fillRect(this.w / 2 - 4, -10, this.def.attackRange, 20);
    }

    ctx.restore();

    // health bar above head (only if damaged)
    if (!this.dead && this.hp < this.maxHp) {
      const bw = 34;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sx - bw / 2, sy - this.h / 2 - 12, bw, 5);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(sx - bw / 2, sy - this.h / 2 - 12, bw * clamp(this.hp / this.maxHp, 0, 1), 5);
    }
  }
}
