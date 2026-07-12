// ============================================================
// utils.js — shared helper functions
// ============================================================

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

function randRange(min, max) { return min + Math.random() * (max - min); }

function randInt(min, max) { return Math.floor(randRange(min, max + 1)); }

function lerp(a, b, t) { return a + (b - a) * t; }

// Simple formatted number (adds commas) for large soul/coin counts
function fmt(n) { return Math.floor(n).toLocaleString(); }

// Draws a rounded rectangle path (used by several render routines)
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
