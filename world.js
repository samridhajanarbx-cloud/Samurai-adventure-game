// ============================================================
// world.js — the open world: zones, terrain, parkour, spawn tables
// ============================================================

const ZONES = [
  {
    key: 'bamboo', name: 'Bamboo Forest', xStart: 0, xEnd: 2000,
    sky: ['#7fb8c9', '#c7e8d4'], ground: '#3d5e3a', accent: '#6b8f4e',
    enemyTypes: ['bandit'], weather: 'none'
  },
  {
    key: 'village', name: 'Ancient Village', xStart: 2000, xEnd: 4000,
    sky: ['#e8c98a', '#f4e0b0'], ground: '#6b4a2f', accent: '#8a6a3f',
    enemyTypes: ['bandit', 'ninja'], weather: 'none',
    boss: { id: 'oni', x: 3800 }
  },
  {
    key: 'temple', name: 'Abandoned Temple', xStart: 4000, xEnd: 6000,
    sky: ['#5a4a6e', '#8a6a8e'], ground: '#4a3a4a', accent: '#6a4a6a',
    enemyTypes: ['ninja', 'skeleton'], weather: 'fog'
  },
  {
    key: 'caves', name: 'Dark Caves', xStart: 6000, xEnd: 8000,
    sky: ['#0d0d16', '#1a1424'], ground: '#25202a', accent: '#3a2f3a',
    enemyTypes: ['skeleton', 'shadow_beast'], weather: 'none',
    boss: { id: 'shadow_samurai', x: 7800 }
  },
  {
    key: 'mountain', name: 'Mountain Peaks', xStart: 8000, xEnd: 10000,
    sky: ['#3a5a8a', '#a8c8e8'], ground: '#5a5a6a', accent: '#7a7a8a',
    enemyTypes: ['corrupted_samurai', 'ninja'], weather: 'wind'
  },
  {
    key: 'sanctuary', name: 'Dragon Sanctuary', xStart: 10000, xEnd: 12200,
    sky: ['#8a1a3a', '#e8703a'], ground: '#3a1a2a', accent: '#7a2a3a',
    enemyTypes: ['corrupted_samurai', 'shadow_beast'], weather: 'rain',
    boss: { id: 'dragon_spirit', x: 11200 }
  }
];

// The final boss lives at the very end, past the dragon sanctuary
const FINAL_BOSS = { id: 'soul_king', x: 12050 };

const WORLD_WIDTH = 12300;
const GROUND_BASE_Y = 620;

function getZoneAt(x) {
  return ZONES.find(z => x >= z.xStart && x < z.xEnd) || ZONES[ZONES.length - 1];
}

class World {
  constructor() {
    this.platforms = [];      // solid ground/platform rects: {x,y,w,h,type}
    this.movingPlatforms = []; // {x,y,w,h,baseY,range,speed,phase}
    this.spawnPoints = [];    // enemy spawn definitions
    this.bossTriggers = [];   // {x, bossId, name, spawned:false}
    this.build();
  }

  build() {
    let x = 0;
    // Base rolling ground with occasional gaps, per zone flavor.
    while (x < WORLD_WIDTH) {
      const zone = getZoneAt(x);
      const segW = randRange(180, 340);
      const gap = Math.random() < 0.14 && x > 300 ? randRange(70, 130) : 0;
      const yWobble = zone.key === 'mountain' ? randRange(-90, 10) : randRange(-30, 30);
      const groundY = GROUND_BASE_Y + yWobble;

      this.platforms.push({ x, y: groundY, w: segW, h: 720 - groundY, type: 'ground', zone: zone.key });

      // occasional floating platform above a gap or just for verticality
      if (Math.random() < 0.35) {
        this.platforms.push({
          x: x + segW * 0.3, y: groundY - randRange(110, 220), w: randRange(90, 160), h: 20, type: 'platform', zone: zone.key
        });
      }

      // spike traps on some segments (not first 500px, keep early game friendly)
      if (x > 600 && Math.random() < 0.1) {
        this.platforms.push({ x: x + segW * 0.5, y: groundY - 14, w: 34, h: 14, type: 'spike', zone: zone.key });
      }

      // moving platform to cross bigger gaps
      if (gap > 90) {
        this.movingPlatforms.push({
          x: x + segW, baseY: groundY - 40, y: groundY - 40, w: 80, h: 18,
          range: gap * 0.9, speed: randRange(60, 110), phase: Math.random() * Math.PI * 2, axis: 'x'
        });
      }

      // enemy spawn point roughly every ~350-500px
      if (Math.random() < 0.55 && zone.enemyTypes.length) {
        const type = zone.enemyTypes[randInt(0, zone.enemyTypes.length - 1)];
        this.spawnPoints.push({
          id: this.spawnPoints.length, type, x: x + segW * 0.5, y: groundY - 60, zone: zone.key,
          respawnTimer: 0, alive: false
        });
      }

      x += segW + gap;
    }

    // vertical wall-jump shaft in the mountain zone (approx x 9000-9200)
    const shaftX = 9000;
    for (let sy = GROUND_BASE_Y - 500; sy < GROUND_BASE_Y; sy += 140) {
      this.platforms.push({ x: shaftX, y: sy, w: 24, h: 100, type: 'wall', zone: 'mountain' });
      this.platforms.push({ x: shaftX + 220, y: sy + 70, w: 24, h: 100, type: 'wall', zone: 'mountain' });
    }
    this.platforms.push({ x: shaftX, y: GROUND_BASE_Y - 560, w: 260, h: 30, type: 'ground', zone: 'mountain' });

    // moving platform tower in temple zone for secret loot
    this.movingPlatforms.push({ x: 4600, baseY: GROUND_BASE_Y - 60, y: GROUND_BASE_Y - 60, w: 90, h: 18, range: 220, speed: 70, phase: 0, axis: 'y' });

    // boss trigger zones
    ZONES.forEach(z => {
      if (z.boss) this.bossTriggers.push({ x: z.boss.x, bossId: z.boss.id, spawned: false, zoneKey: z.key });
    });
    this.bossTriggers.push({ x: FINAL_BOSS.x, bossId: FINAL_BOSS.id, spawned: false, zoneKey: 'sanctuary', final: true });

    // ensure a solid platform under every boss trigger (boss arena floor)
    this.bossTriggers.forEach(bt => {
      this.platforms.push({ x: bt.x - 400, y: GROUND_BASE_Y, w: 900, h: 100, type: 'ground', zone: bt.zoneKey });
    });

    // starting shrine platform
    this.platforms.push({ x: -100, y: GROUND_BASE_Y, w: 400, h: 100, type: 'ground', zone: 'bamboo' });

    this.finalizeMovers();
  }

  updateMovingPlatforms(dt) {
    this.movingPlatforms.forEach(mp => {
      mp.phase += dt * (mp.speed / 60);
      if (mp.axis === 'x') mp.x = mp.origX !== undefined ? mp.origX + Math.sin(mp.phase) * mp.range : mp.x;
      else mp.y = mp.baseY + Math.sin(mp.phase) * (mp.range / 2);
    });
  }

  // returns all currently-solid platforms near a given x range (perf: skip filtering for simplicity, world isn't huge)
  getAllSolids() {
    return this.platforms.concat(this.movingPlatforms.map(mp => ({ x: mp.x, y: mp.y, w: mp.w, h: mp.h, type: 'platform' })));
  }
}

// fix origX capture for horizontal moving platforms after construction
World.prototype.finalizeMovers = function () {
  this.movingPlatforms.forEach(mp => { if (mp.origX === undefined) mp.origX = mp.x; });
};
