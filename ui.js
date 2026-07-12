// ============================================================
// ui.js — HUD updates and menu screens (DOM overlay, not canvas)
// ============================================================

const UI = {
  els: {},

  init() {
    this.els = {
      healthBar: document.getElementById('healthBar'),
      staminaBar: document.getElementById('staminaBar'),
      soulCount: document.getElementById('soulCount'),
      coinCount: document.getElementById('coinCount'),
      weaponDisplay: document.getElementById('weaponDisplay'),
      zoneBanner: document.getElementById('zoneBanner'),
      bossBarWrap: document.getElementById('bossBarWrap'),
      bossName: document.getElementById('bossName'),
      bossBar: document.getElementById('bossBar'),
      prompt: document.getElementById('prompt'),
      startScreen: document.getElementById('startScreen'),
      pauseScreen: document.getElementById('pauseScreen'),
      shopScreen: document.getElementById('shopScreen'),
      deathScreen: document.getElementById('deathScreen'),
      weaponList: document.getElementById('weaponList'),
      shopCoinCount: document.getElementById('shopCoinCount'),
      continueBtn: document.getElementById('continueBtn')
    };
    this.els.continueBtn.style.display = hasSaveGame() ? 'inline-block' : 'none';
    this._lastZone = null;
    this._bannerTimeout = null;
  },

  updateHUD(player) {
    const hpPct = clamp((player.health / player.getMaxHealth()) * 100, 0, 100);
    this.els.healthBar.style.width = hpPct + '%';
    const stPct = clamp((player.stamina / player.maxStamina) * 100, 0, 100);
    this.els.staminaBar.style.width = stPct + '%';
    this.els.soulCount.textContent = fmt(player.souls);
    this.els.coinCount.textContent = fmt(player.coins);
    this.els.weaponDisplay.textContent = '🗡️ ' + player.getWeapon().name;
  },

  showZoneBanner(name) {
    if (this._lastZone === name) return;
    this._lastZone = name;
    this.els.zoneBanner.textContent = name;
    this.els.zoneBanner.classList.add('show');
    clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => this.els.zoneBanner.classList.remove('show'), 2600);
  },

  updateBossBar(boss) {
    if (!boss || boss.dead) { this.els.bossBarWrap.classList.add('hidden'); return; }
    this.els.bossBarWrap.classList.remove('hidden');
    this.els.bossName.textContent = boss.def.name;
    const pct = clamp((boss.hp / boss.maxHp) * 100, 0, 100);
    this.els.bossBar.style.width = pct + '%';
  },

  showPrompt(text) { this.els.prompt.textContent = text; this.els.prompt.classList.remove('hidden'); },
  hidePrompt() { this.els.prompt.classList.add('hidden'); },

  showScreen(name) {
    ['startScreen', 'pauseScreen', 'shopScreen', 'deathScreen'].forEach(s => this.els[s].classList.add('hidden'));
    if (name) this.els[name].classList.remove('hidden');
  },

  renderShop(player, onBuy, onEquip) {
    this.els.shopCoinCount.textContent = fmt(player.coins);
    this.els.weaponList.innerHTML = '';
    KATANAS.forEach(k => {
      const owned = player.ownedWeapons.includes(k.id);
      const equipped = player.equippedWeaponId === k.id;
      const card = document.createElement('div');
      card.className = 'weaponCard' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '');
      card.innerHTML = `
        <div class="weaponInfo">
          <b>${k.name}</b>
          <div class="stats">DMG ${k.damage} &nbsp;|&nbsp; Speed ${(1000 / k.cooldown).toFixed(1)}/s &nbsp;|&nbsp; Range ${k.range}</div>
          <div class="special">${k.desc}</div>
        </div>
      `;
      const btn = document.createElement('button');
      if (equipped) { btn.textContent = 'Equipped'; btn.disabled = true; }
      else if (owned) { btn.textContent = 'Equip'; btn.onclick = () => onEquip(k.id); }
      else { btn.textContent = `Buy (${k.cost} 💰)`; btn.disabled = player.coins < k.cost; btn.onclick = () => onBuy(k.id); }
      card.appendChild(btn);
      this.els.weaponList.appendChild(card);
    });
  }
};
