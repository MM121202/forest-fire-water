// H5 主控制器：固定步长主循环 + 键盘/Pointer 多指触屏输入合并 + 渲染 + 菜单/结算。
import { Game } from "../engine/game.js";
import { LEVELS } from "../levels/index.js";
import { TILE, DT, HERO_W, HERO_H, CHARS } from "../engine/constants.js";
import { tileAt } from "../engine/level.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = 800;
const H = 512;

const IDLE = { left: false, right: false, jump: false };

// ---------- 输入：键盘 + Pointer 多指触屏，buildInput() 合并 ----------
const keys = new Set();
const touchState = {
  fire: { left: false, right: false, jump: false },
  water: { left: false, right: false, jump: false },
};

const KRELEVANT = new Set([
  "a", "d", "w", "arrowleft", "arrowright", "arrowup", "tab", "r",
]);
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (KRELEVANT.has(k)) {
    if (k.startsWith("arrow")) e.preventDefault();
    if (k === "tab") {
      e.preventDefault();
      if (mode === "single") active = active === CHARS.FIRE ? CHARS.WATER : CHARS.FIRE;
      updateActiveTag();
      return;
    }
    if (k === "r") {
      restart();
      return;
    }
    keys.add(k);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());

function buildInput() {
  const fk = { left: keys.has("a"), right: keys.has("d"), jump: keys.has("w") };
  const wk = {
    left: keys.has("arrowleft"),
    right: keys.has("arrowright"),
    jump: keys.has("arrowup"),
  };
  const fire = {
    left: fk.left || touchState.fire.left,
    right: fk.right || touchState.fire.right,
    jump: fk.jump || touchState.fire.jump,
  };
  const water = {
    left: wk.left || touchState.water.left,
    right: wk.right || touchState.water.right,
    jump: wk.jump || touchState.water.jump,
  };
  if (mode === "single") {
    const merged = {
      left: fire.left || water.left,
      right: fire.right || water.right,
      jump: fire.jump || water.jump,
    };
    return active === CHARS.FIRE
      ? { fire: merged, water: IDLE }
      : { fire: IDLE, water: merged };
  }
  return { fire, water };
}

// 触屏虚拟按键（双人分屏 / 单人切换）
function buildTouch() {
  const touch = document.getElementById("touch");
  const make = (cls, label) => {
    const b = document.createElement("div");
    b.className = "tbtn " + cls;
    b.textContent = label;
    return b;
  };
  const cluster = (side, who) => {
    const c = document.createElement("div");
    c.className = "touch-cluster";
    const left = make(side, "◀");
    const right = make(side, "▶");
    const up = make(side, "▲");
    up.style.alignSelf = "flex-end";
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.appendChild(left);
    row.appendChild(right);
    const col = document.createElement("div");
    col.style.display = "flex";
    col.style.flexDirection = "column";
    col.style.alignItems = "center";
    col.style.gap = "8px";
    col.appendChild(up);
    col.appendChild(row);
    bindBtn(left, who, "left");
    bindBtn(right, who, "right");
    bindBtn(up, who, "jump");
    c.appendChild(col);
    return c;
  };
  const fireC = cluster("fire", CHARS.FIRE);
  const waterC = cluster("water", CHARS.WATER);
  const mid = document.createElement("div");
  mid.className = "touch-cluster mid";
  const sw = make("switch", "切换");
  sw.addEventListener("click", () => {
    active = active === CHARS.FIRE ? CHARS.WATER : CHARS.FIRE;
    updateActiveTag();
  });
  mid.appendChild(sw);
  touch.appendChild(fireC);
  touch.appendChild(mid);
  touch.appendChild(waterC);
}

function bindBtn(el, who, action) {
  const set = (v) => {
    touchState[who][action] = v;
    el.classList.toggle("active", v);
  };
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId); // PRD D3：捕获防丢键
    set(true);
  });
  const off = () => set(false);
  el.addEventListener("pointerup", off);
  el.addEventListener("pointercancel", off);
  el.addEventListener("pointerleave", off);
}

// ---------- 游戏状态 ----------
let level = LEVELS[0];
let game = new Game(level);
let mode = "double"; // double | single
let active = CHARS.FIRE;
let started = false;
let resultShown = false;

const menu = document.getElementById("menu");
const result = document.getElementById("result");
const levelList = document.getElementById("level-list");

function buildMenu() {
  levelList.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const b = document.createElement("button");
    b.className = "level-btn";
    b.textContent = `${i + 1}. ${lv.name}`;
    b.addEventListener("click", () => startLevel(i));
    levelList.appendChild(b);
  });
}

function startLevel(i) {
  level = LEVELS[i];
  game = new Game(level);
  started = true;
  resultShown = false;
  menu.hidden = true;
  result.hidden = true;
  updateActiveTag();
}

function restart() {
  if (!started) return;
  game.reset();
  resultShown = false;
  result.hidden = true;
}

function toMenu() {
  started = false;
  menu.hidden = false;
  result.hidden = true;
}

function showResult() {
  resultShown = true;
  const title = document.getElementById("result-title");
  const detail = document.getElementById("result-detail");
  const btnNext = document.getElementById("btn-next");
  const idx = LEVELS.indexOf(level);
  if (game.status === "won") {
    title.textContent = "通关！";
    const total = level.diamonds.length;
    detail.innerHTML = `用时 ${(game.timer).toFixed(1)}s · 钻石 ${game.collected.size}/${total} · 失误 ${game.deaths}`;
    btnNext.hidden = idx >= LEVELS.length - 1;
  } else {
    title.textContent = "失败！";
    detail.textContent = `失误 ${game.deaths}（按 R 或「重玩本关」再来）`;
    btnNext.hidden = true;
  }
  result.hidden = false;
}

document.getElementById("btn-retry").addEventListener("click", restart);
document.getElementById("btn-menu").addEventListener("click", toMenu);
document.getElementById("btn-menu2").addEventListener("click", toMenu);
document.getElementById("btn-next").addEventListener("click", () => {
  const idx = LEVELS.indexOf(level);
  if (idx < LEVELS.length - 1) startLevel(idx + 1);
});
document.getElementById("btn-restart").addEventListener("click", restart);
document.getElementById("btn-mode").addEventListener("click", (e) => {
  mode = mode === "double" ? "single" : "double";
  e.target.textContent = "模式：" + (mode === "double" ? "双人" : "单人");
  updateActiveTag();
});

function updateActiveTag() {
  const tag = document.getElementById("active-tag");
  if (mode === "single" && started) {
    tag.hidden = false;
    tag.textContent = "操控：" + (active === CHARS.FIRE ? "🔥火人" : "💧水人");
  } else {
    tag.hidden = true;
  }
}

// ---------- 渲染 ----------
function drawTile(c, x, y) {
  const px = x * TILE;
  const py = y * TILE;
  switch (c) {
    case "#":
      ctx.fillStyle = "#2c333f";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#3a4351";
      ctx.fillRect(px, py, TILE, 4);
      break;
    case "L": // 岩浆
      ctx.fillStyle = "#ff7a3c";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#ffb15a";
      ctx.fillRect(px, py, TILE, 6);
      break;
    case "W": // 水池
      ctx.fillStyle = "#2f7de0";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#7fc0ff";
      ctx.fillRect(px, py, TILE, 6);
      break;
    case "A": // 绿酸
      ctx.fillStyle = "#39d36b";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#9bf0b4";
      ctx.fillRect(px, py, TILE, 6);
      break;
    case "-": // 火板
      ctx.fillStyle = "rgba(255,90,77,0.35)";
      ctx.fillRect(px + 3, py + TILE - 8, TILE - 6, 6);
      break;
    case "=": // 水板
      ctx.fillStyle = "rgba(58,160,255,0.35)";
      ctx.fillRect(px + 3, py + TILE - 8, TILE - 6, 6);
      break;
    case "g": // g 门（受火板控制）
    case "h": {
      const open = c === "g" ? game.gOpen : game.hOpen;
      ctx.fillStyle = open ? "rgba(120,200,255,0.15)" : "#c9a23a";
      ctx.fillRect(px + 4, py, TILE - 8, TILE);
      if (!open) {
        ctx.fillStyle = "#8a6e1f";
        for (let i = 0; i < 4; i++)
          ctx.fillRect(px + 6, py + 4 + i * 7, TILE - 12, 4);
      }
      break;
    }
    case "R": // 火门
      ctx.fillStyle = "rgba(255,90,77,0.5)";
      ctx.fillRect(px + 2, py, TILE - 4, TILE);
      break;
    case "B": // 水门
      ctx.fillStyle = "rgba(58,160,255,0.5)";
      ctx.fillRect(px + 2, py, TILE - 4, TILE);
      break;
    default:
      break;
  }
}

function drawDiamond(x, y, color) {
  const cx = x * TILE + TILE / 2;
  const cy = y * TILE + TILE / 2;
  ctx.fillStyle = color === "red" ? "#ff5a4d" : "#3aa0ff";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 9);
  ctx.lineTo(cx + 7, cy);
  ctx.lineTo(cx, cy + 9);
  ctx.lineTo(cx - 7, cy);
  ctx.closePath();
  ctx.fill();
}

function drawHero(e, base) {
  const x = e.x;
  const y = e.y;
  const face = e.vx < -8 ? -2 : e.vx > 8 ? 2 : 0; // 眼睛随移动方向微倾，增加灵动感
  ctx.fillStyle = base;
  roundRect(x, y, HERO_W, HERO_H, 6);
  ctx.fill();
  // 眼睛
  ctx.fillStyle = "#0b0f16";
  ctx.fillRect(x + 5 + face, y + 8, 4, 4);
  ctx.fillRect(x + HERO_W - 9 + face, y + 8, 4, 4);
  if (game.status === "dead") {
    ctx.strokeStyle = "#0b0f16";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 6);
    ctx.lineTo(x + HERO_W - 4, y + HERO_H - 6);
    ctx.moveTo(x + HERO_W - 4, y + 6);
    ctx.lineTo(x + 4, y + HERO_H - 6);
    ctx.stroke();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  // 背景
  ctx.fillStyle = "#0b0f16";
  ctx.fillRect(0, 0, W, H);
  // 关卡
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const c = tileAt(level.grid, x, y);
      drawTile(c, x, y);
    }
  }
  // 钻石（未拾取）
  for (const d of level.diamonds) {
    if (!game.collected.has(`${d.x},${d.y}`)) drawDiamond(d.x, d.y, d.color);
  }
  // 角色
  drawHero(game.fire, "#ff5a4d");
  drawHero(game.water, "#3aa0ff");

  // HUD
  document.getElementById("hud-deaths").textContent = `失误 ${game.deaths}`;
  document.getElementById("hud-time").textContent = `${game.timer.toFixed(1)}s`;
  document.getElementById("hud-diamonds").textContent = `💎 ${game.collected.size}/${level.diamonds.length}`;
}

// ---------- 主循环（固定步长 + 累加器，PRD D1） ----------
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let guard = 0;
  while (acc >= DT && guard < 8) {
    if (started && game.status === "playing") {
      game.step(buildInput());
    }
    acc -= DT;
    guard++;
  }
  if (started && game.status !== "playing" && !resultShown) showResult();
  render();
  requestAnimationFrame(frame);
}

buildTouch();
buildMenu();
updateActiveTag();
requestAnimationFrame(frame);
