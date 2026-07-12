// ============================================================
// weapons.js — Katana definitions & the weapon upgrade shop data
// ============================================================

// Each katana: damage (raw), cooldown (ms between swings — lower = faster),
// range (pixels), cost (coins), special (id used by combat logic), color (blade tint)
const KATANAS = [
  {
    id: 'rusted', name: 'Rusted Katana', damage: 8, cooldown: 480, range: 62,
    cost: 0, special: null,
    desc: 'A weathered blade found on the road. Reliable, if unimpressive.',
    color: '#9a9a8c'
  },
  {
    id: 'iron', name: 'Iron Katana', damage: 13, cooldown: 440, range: 64,
    cost: 80, special: null,
    desc: 'Forged iron with a keener edge.',
    color: '#c9c9d4'
  },
  {
    id: 'steel', name: 'Steel Katana', damage: 19, cooldown: 400, range: 66,
    cost: 220, special: 'crit',
    desc: 'Polished steel. 15% chance to land a critical strike (2x damage).',
    color: '#e2e8f0'
  },
  {
    id: 'master', name: 'Samurai Master Blade', damage: 27, cooldown: 360, range: 70,
    cost: 500, special: 'lifesteal',
    desc: 'Wielded by a fallen master. Heals you for a portion of damage dealt.',
    color: '#ffd88a'
  },
  {
    id: 'reaper', name: 'Soul Reaper Katana', damage: 36, cooldown: 340, range: 74,
    cost: 1100, special: 'soulmagnet',
    desc: 'Hungers for souls. Doubles soul drops and pulls them from farther away.',
    color: '#7ee8c8'
  },
  {
    id: 'dragon', name: 'Dragon Katana', damage: 48, cooldown: 310, range: 78,
    cost: 2200, special: 'fire',
    desc: 'Wreathed in dragonfire. Applies a burning damage-over-time effect.',
    color: '#ff8a3d'
  },
  {
    id: 'celestial', name: 'Legendary Celestial Katana', damage: 68, cooldown: 260, range: 86,
    cost: 4500, special: 'execute',
    desc: 'A blade said to be forged from starlight. Instantly executes enemies below 12% health.',
    color: '#c9a8ff'
  }
];

function getKatana(id) { return KATANAS.find(k => k.id === id) || KATANAS[0]; }
