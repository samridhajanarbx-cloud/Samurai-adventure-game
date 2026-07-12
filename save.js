// ============================================================
// save.js — persistence via localStorage
// ============================================================

const SAVE_KEY = 'soulSamuraiSave_v1';

function saveGame(player) {
  const data = {
    souls: player.souls,
    coins: player.coins,
    ownedWeapons: player.ownedWeapons,
    equippedWeaponId: player.equippedWeaponId,
    defeatedBosses: player.defeatedBosses,
    checkpoint: player.checkpoint,
    savedAt: Date.now()
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

function hasSaveGame() {
  return !!localStorage.getItem(SAVE_KEY);
}

function loadGame(player) {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    player.souls = data.souls || 0;
    player.coins = data.coins || 0;
    player.ownedWeapons = data.ownedWeapons && data.ownedWeapons.length ? data.ownedWeapons : ['rusted'];
    player.equippedWeaponId = data.equippedWeaponId || 'rusted';
    player.defeatedBosses = data.defeatedBosses || [];
    if (data.checkpoint) {
      player.checkpoint = data.checkpoint;
      player.x = data.checkpoint.x;
      player.y = data.checkpoint.y;
    }
    player.health = player.getMaxHealth();
    return true;
  } catch (e) {
    console.warn('Load failed', e);
    return false;
  }
}

function clearSaveGame() {
  localStorage.removeItem(SAVE_KEY);
}
