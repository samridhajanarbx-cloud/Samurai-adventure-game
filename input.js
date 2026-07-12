// ============================================================
// input.js — keyboard & mouse state tracking
// ============================================================

const KEYS = {};
const KEY_PRESSED = {}; // true only for the single frame the key went down

let MOUSE_DOWN = false;
let MOUSE_CLICK = false;

window.addEventListener('keydown', (e) => {
  if (!KEYS[e.code]) KEY_PRESSED[e.code] = true;
  KEYS[e.code] = true;
  // prevent page scroll on game keys
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});

window.addEventListener('keyup', (e) => { KEYS[e.code] = false; });

document.getElementById('gameCanvas').addEventListener('mousedown', () => {
  MOUSE_DOWN = true; MOUSE_CLICK = true;
});
window.addEventListener('mouseup', () => { MOUSE_DOWN = false; });

function isDown(...codes) { return codes.some(c => KEYS[c]); }
function wasPressed(code) {
  if (KEY_PRESSED[code]) { KEY_PRESSED[code] = false; return true; }
  return false;
}
function consumeClick() {
  if (MOUSE_CLICK) { MOUSE_CLICK = false; return true; }
  return false;
}
