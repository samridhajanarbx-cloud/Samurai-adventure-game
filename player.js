// ============================================================
// player.js — the Samurai. Movement, combat, stamina, soul-driven
// permanent progression.
// ============================================================

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 34; this.h = 56;
    this.vx = 0; this.vy = 0;
    this.facing = 1; // 1 = right, -1 = left
    this.onGround = false;
    this.onWall = 0; // -1 left wall, 1 right wall, 0 none

    // ---- base stats (before soul bonuses) ----
    this.baseMaxHealth = 100;
    this.baseSpeed = 300;
    this.baseDamageBonus = 0;

    // ---- progression ----
    this.souls = 0;
    this.coins = 0;
    this.ownedWeapons = ['rusted'];
    this.equippedWeaponId = 'rusted';
    this.defeatedBosses = [];

    this.health = this.getMaxHealth();
    this.maxStamina = 100;
    this.stamina = this.maxStamina;

    // ---- jump / dash state ----
    this.jumpsLeft = 2;
    this.canDoubleJump = true;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.dashDir = 0;
    this.isDashing = false;
    this.invuln = 0;

    // ---- combat ----
    this.attackCooldown = 0;
    this.attackAnimTimer = 0;
    this.isAttacking = false;
    this.burnTimer = 0; // enemies set this... (not used on player)
    this.comboFlash = 0;

    this.checkpoint = { x, y, zone: 0 };
    this.dead = false;
    this.respawnTimer = 0;

    this.hurtFlash = 0;
  }

  // ---- Soul-derived permanent bonuses ----
  getSoulBonusDamage() { return Math.floor(this.souls / 40); }
  getSoulBonusHealth() { return Math.floor(this.souls / 8); }
  getSoulBonusSpeed() { return Math.min(this.souls * 0.06, 90); }
  getMaxHealth() { return this.baseMaxHealth + this.getSoulBonusHealth(); }
  getSpeed() { return this.baseSpeed + this.getSoulBonusSpeed(); }
  getWeapon() { return getKatana(this.equippedWeaponId); }
  getTotalDamage() {
    const w = this.getWeapon();
    return w.damage + this.getSoulBonusDamage();
  }

  addSouls(amount) {
    const w = this.getWeapon();
    if (w.special === 'soulmagnet') amount *= 2;
    this.souls += amount;
    // recompute health ratio-preserving bump
    const ratio = this.health / this.getMaxHealth();
    this._lastMax = this.getMaxHealth();
  }

  addCoins(amount) { this.coins += amount; }

  takeDamage(amount, knockX = 0) {
    if (this.invuln > 0 || this.dead) return;
    this.health -= amount;
    this.invuln = 0.8;
    this.hurtFlash = 0.25;
    this.vx = knockX;
    this.vy = -220;
    AUDIO.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.respawnTimer = 1.4;
    }
  }

  heal(amount) { this.health = clamp(this.health + amount, 0, this.getMaxHealth()); }

  respawn() {
    this.dead = false;
    this.x = this.checkpoint.x;
    this.y = this.checkpoint.y;
    this.vx = 0; this.vy = 0;
    this.health = this.getMaxHealth();
    this.stamina = this.maxStamina;
    this.invuln = 1.5;
  }

  setCheckpoint(x, y, zone) { this.checkpoint = { x, y, zone }; }

  buyWeapon(id) {
    const k = getKatana(id);
    if (!k || this.ownedWeapons.includes(id) || this.coins < k.cost) return false;
    this.coins -= k.cost;
    this.ownedWeapons.push(id);
    AUDIO.purchase();
    return true;
  }

  equipWeapon(id) {
    if (!this.ownedWeapons.includes(id)) return false;
    this.equippedWeaponId = id;
    return true;
  }

  getHitbox() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  getAttackHitbox() {
    const w = this.getWeapon();
    const reach = w.range;
    if (this.facing === 1) {
      return { x: this.x + this.w / 2 - 6, y: this.y - 30, w: reach, h: 46 };
    } else {
      return { x: this.x - this.w / 2 + 6 - reach, y: this.y - 30, w: reach, h: 46 };
    }
  }

  // main per-frame update; `platforms` = solid collidable rects for this zone
  update(dt, platforms, particles) {
    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);
    if (this.attackAnimTimer <= 0) this.isAttacking = false;
    this.comboFlash = Math.max(0, this.comboFlash - dt);

    // ---- horizontal input ----
    const speed = this.getSpeed();
    let moveDir = 0;
    if (isDown('KeyA', 'ArrowLeft')) moveDir -= 1;
    if (isDown('KeyD', 'ArrowRight')) moveDir += 1;

    if (!this.isDashing) {
      this.vx = moveDir * speed;
      if (moveDir !== 0) this.facing = moveDir;
    }

    // ---- dash ----
    if (wasPressed('ShiftLeft') || wasPressed('ShiftRight')) {
      if (this.dashCooldown <= 0 && this.stamina >= 25 && !this.isDashing) {
        this.isDashing = true;
        this.dashTimer = 0.18;
        this.dashDir = this.facing;
        this.dashCooldown = 0.7;
        this.stamina -= 25;
        this.invuln = Math.max(this.invuln, 0.18);
        AUDIO.dash();
      }
    }
    if (this.isDashing) {
      this.dashTimer -= dt;
      this.vx = this.dashDir * speed * 3.2;
      if (this.dashTimer % 0.05 < dt) particles.spawnDust(this.x, this.y + this.h / 2);
      if (this.dashTimer <= 0) this.isDashing = false;
    }

    // ---- jump ----
    if (wasPressed('KeyW') || wasPressed('ArrowUp') || wasPressed('Space')) {
      if (this.onGround) {
        this.vy = -560; this.onGround = false; this.jumpsLeft = 1; AUDIO.jump();
      } else if (this.onWall !== 0) {
        this.vy = -540; this.vx = -this.onWall * speed * 1.3; this.jumpsLeft = 1; AUDIO.jump();
      } else if (this.jumpsLeft > 0) {
        this.vy = -500; this.jumpsLeft -= 1; AUDIO.jump();
        particles.spawnDust(this.x, this.y);
      }
    }

    // ---- gravity ----
    const gravity = 1500;
    this.vy += gravity * dt;
    if (this.onWall !== 0 && this.vy > 80 && !this.onGround) this.vy = 80; // wall slide

    if (this.vy > 1400) this.vy = 1400;

    // ---- attack ----
    const attackPressed = wasPressed('KeyJ') || consumeClick();
    if (attackPressed && this.attackCooldown <= 0) {
      const w = this.getWeapon();
      this.attackCooldown = w.cooldown / 1000;
      this.attackAnimTimer = 0.18;
      this.isAttacking = true;
      AUDIO.slash();
      const hb = this.getAttackHitbox();
      particles.spawnSlash(hb.x + (this.facing === 1 ? 0 : hb.w), this.y - 6, this.facing);
      this._justAttacked = true;
    } else {
      this._justAttacked = false;
    }

    // ---- stamina regen ----
    if (!this.isDashing) this.stamina = clamp(this.stamina + dt * 22, 0, this.maxStamina);

    // ---- integrate position & collide ----
    this.x += this.vx * dt;
    this.resolveCollisions(platforms, 'x');
    this.y += this.vy * dt;
    this.onGround = false;
    this.onWall = 0;
    this.resolveCollisions(platforms, 'y');

    // wall detection (only when airborne and pressing into a wall)
    if (!this.onGround) {
      const hb = this.getHitbox();
      for (const p of platforms) {
        if (p.type === 'spike') continue;
        const leftTouch = Math.abs((hb.x) - (p.x + p.w)) < 4 && hb.y + hb.h > p.y && hb.y < p.y + p.h;
        const rightTouch = Math.abs((hb.x + hb.w) - p.x) < 4 && hb.y + hb.h > p.y && hb.y < p.y + p.h;
        if (leftTouch && moveDir < 0) this.onWall = -1;
        if (rightTouch && moveDir > 0) this.onWall = 1;
      }
      if (this.onWall !== 0) this.jumpsLeft = Math.max(this.jumpsLeft, 1);
    }

    if (this.onGround) this.jumpsLeft = 2;

    // spike traps => instant damage
    const hb2 = this.getHitbox();
    for (const p of platforms) {
      if (p.type === 'spike' && rectsOverlap(hb2, p)) {
        this.takeDamage(15, -this.facing * 260);
      }
    }

    // fell off the world
    if (this.y > 2200) this.takeDamage(9999);
  }

  resolveCollisions(platforms, axis) {
    const hb = this.getHitbox();
    for (const p of platforms) {
      if (p.type === 'spike') continue;
      if (!rectsOverlap(hb, p)) continue;
      if (axis === 'x') {
        if (this.vx > 0) this.x = p.x - this.w / 2;
        else if (this.vx < 0) this.x = p.x + p.w + this.w / 2;
        this.vx = 0;
      } else {
        if (this.vy > 0) {
          this.y = p.y - this.h / 2;
          this.vy = 0;
          this.onGround = true;
          this.jumpsLeft = 2;
        } else if (this.vy < 0) {
          this.y = p.y + p.h + this.h / 2;
          this.vy = 0;
        }
      }
      const hb2 = this.getHitbox();
      hb.x = hb2.x; hb.y = hb2.y;
    }
  }

  draw(ctx, camX, camY) {
    if (this.dead) return;
    const sx = this.x - camX, sy = this.y - camY;
    ctx.save();
    if (this.hurtFlash > 0 && Math.floor(this.hurtFlash * 30) % 2 === 0) ctx.globalAlpha = 0.4;
    if (this.invuln > 0 && this.isDashing) ctx.globalAlpha = 0.6;

    ctx.translate(sx, sy);
    ctx.scale(this.facing, 1);

    // legs
    ctx.fillStyle = '#22242b';
    ctx.fillRect(-10, 8, 8, 20);
    ctx.fillRect(2, 8, 8, 20);

    // torso / robe
    ctx.fillStyle = '#7a1f1f';
    ctx.fillRect(-12, -18, 24, 30);
    ctx.fillStyle = '#3a0d0d';
    ctx.fillRect(-12, -18, 24, 8);

    // belt
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(-12, 6, 24, 4);

    // head
    ctx.fillStyle = '#e8c39e';
    ctx.beginPath(); ctx.arc(0, -28, 10, 0, Math.PI * 2); ctx.fill();
    // hair/hat
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.arc(0, -32, 10, Math.PI, 0); ctx.fill();

    // katana (idle sheathed on back, or swinging when attacking)
    const w = this.getWeapon();
    ctx.strokeStyle = w.color;
    ctx.lineWidth = 3;
    if (this.isAttacking) {
      const t = 1 - (this.attackAnimTimer / 0.18);
      const ang = lerp(-0.6, 1.6, t);
      ctx.save();
      ctx.translate(12, -8);
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w.range * 0.75, 0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(0, 0, w.range * 0.75, -0.8, 1.2); ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(-8, -6);
      ctx.rotate(-0.5);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
    ctx.restore();
  }
}
