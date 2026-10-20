const { TILE, DT, HERO_W, HERO_H, CHARS } = require("../../src/engine/constants.js");
const { Game } = require("../../src/engine/game.js");
const { LEVELS } = require("../../src/levels/index.js");
const { tileAt } = require("../../src/engine/level.js");

const IDLE = { left: false, right: false, jump: false };
const W = 800;
const H = 512;

Page({
  data: {
    canvasStyle: "",
    modeLabel: "双人",
    activeTag: "",
    resultShow: false,
    resultTitle: "",
    resultDetail: "",
    nextShow: false,
  },

  onLoad(query) {
    this.index = parseInt(query.index || "0", 10);
    this.level = LEVELS[this.index];
    this.game = new Game(this.level);
    this.mode = "double";
    this.active = CHARS.FIRE;
    this.resultShown = false;
    this.touch = {
      fire: { left: false, right: false, jump: false },
      water: { left: false, right: false, jump: false },
    };
    const info = wx.getSystemInfoSync();
    const cw = info.windowWidth - 24;
    const ch = (cw * H) / W;
    this.setData({ canvasStyle: `width:${cw}px;height:${ch}px;` });
  },

  onReady() {
    const q = wx.createSelectorQuery();
    q.select("#game")
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext("2d");
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const cw = res[0].width;
        const ch = res[0].height;
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
        ctx.scale(canvas.width / W, canvas.height / H);
        this.canvas = canvas;
        this.ctx = ctx;
        this.startLoop();
      });
  },

  startLoop() {
    this.last = Date.now();
    this.acc = 0;
    const loop = () => {
      const now = Date.now();
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1;
      this.acc += dt;
      let g = 0;
      while (this.acc >= DT && g < 8) {
        if (this.game.status === "playing") this.game.step(this.buildInput());
        this.acc -= DT;
        g++;
      }
      this.render();
      if (this.game.status !== "playing" && !this.resultShown) this.showResult();
      this._raf = this.canvas.requestAnimationFrame(loop);
    };
    this._raf = this.canvas.requestAnimationFrame(loop);
  },

  onUnload() {
    // 离开页面时停掉渲染循环，避免 navigateBack 后仍在跑
    if (this._raf && this.canvas && this.canvas.cancelAnimationFrame) {
      this.canvas.cancelAnimationFrame(this._raf);
    }
    this._raf = null;
  },

  buildInput() {
    const t = this.touch;
    const fire = { left: t.fire.left, right: t.fire.right, jump: t.fire.jump };
    const water = { left: t.water.left, right: t.water.right, jump: t.water.jump };
    if (this.mode === "single") {
      const merged = {
        left: fire.left || water.left,
        right: fire.right || water.right,
        jump: fire.jump || water.jump,
      };
      return this.active === CHARS.FIRE
        ? { fire: merged, water: IDLE }
        : { fire: IDLE, water: merged };
    }
    return { fire, water };
  },

  onCtrlStart(e) {
    const { who, act } = e.currentTarget.dataset;
    this.touch[who][act] = true;
  },
  onCtrlEnd(e) {
    const { who, act } = e.currentTarget.dataset;
    this.touch[who][act] = false;
  },
  onSwitch() {
    this.active = this.active === CHARS.FIRE ? CHARS.WATER : CHARS.FIRE;
    this.updateTag();
  },
  onMode() {
    this.mode = this.mode === "double" ? "single" : "double";
    this.updateTag();
    this.setData({ modeLabel: this.mode === "double" ? "双人" : "单人" });
  },
  updateTag() {
    this.setData({
      activeTag:
        this.mode === "single"
          ? this.active === CHARS.FIRE
            ? "🔥火人"
            : "💧水人"
          : "",
    });
  },

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b0f16";
    ctx.fillRect(0, 0, W, H);
    const grid = this.level.grid;
    for (let y = 0; y < this.level.h; y++) {
      for (let x = 0; x < this.level.w; x++) {
        this.drawTile(tileAt(grid, x, y), x, y);
      }
    }
    for (const d of this.level.diamonds) {
      if (!this.game.collected.has(d.x + "," + d.y)) this.drawDiamond(d.x, d.y, d.color);
    }
    this.drawHero(this.game.fire, "#ff5a4d");
    this.drawHero(this.game.water, "#3aa0ff");
    // HUD（直接画在画布上，避免每帧 setData）
    ctx.fillStyle = "#9aa7bd";
    ctx.font = "16px sans-serif";
    ctx.fillText(
      `失误 ${this.game.deaths}   时间 ${this.game.timer.toFixed(1)}s   💎 ${this.game.collected.size}/${this.level.diamonds.length}`,
      10,
      22
    );
  },

  drawTile(c, x, y) {
    const ctx = this.ctx;
    const px = x * TILE;
    const py = y * TILE;
    switch (c) {
      case "#":
        ctx.fillStyle = "#2c333f";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#3a4351";
        ctx.fillRect(px, py, TILE, 4);
        break;
      case "L":
        ctx.fillStyle = "#ff7a3c";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#ffb15a";
        ctx.fillRect(px, py, TILE, 6);
        break;
      case "W":
        ctx.fillStyle = "#2f7de0";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#7fc0ff";
        ctx.fillRect(px, py, TILE, 6);
        break;
      case "A":
        ctx.fillStyle = "#39d36b";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#9bf0b4";
        ctx.fillRect(px, py, TILE, 6);
        break;
      case "-":
        ctx.fillStyle = "rgba(255,90,77,0.35)";
        ctx.fillRect(px + 3, py + TILE - 8, TILE - 6, 6);
        break;
      case "=":
        ctx.fillStyle = "rgba(58,160,255,0.35)";
        ctx.fillRect(px + 3, py + TILE - 8, TILE - 6, 6);
        break;
      case "g":
      case "h": {
        const open = c === "g" ? this.game.gOpen : this.game.hOpen;
        ctx.fillStyle = open ? "rgba(120,200,255,0.15)" : "#c9a23a";
        ctx.fillRect(px + 4, py, TILE - 8, TILE);
        if (!open) {
          ctx.fillStyle = "#8a6e1f";
          for (let i = 0; i < 4; i++) ctx.fillRect(px + 6, py + 4 + i * 7, TILE - 12, 4);
        }
        break;
      }
      case "R":
        ctx.fillStyle = "rgba(255,90,77,0.5)";
        ctx.fillRect(px + 2, py, TILE - 4, TILE);
        break;
      case "B":
        ctx.fillStyle = "rgba(58,160,255,0.5)";
        ctx.fillRect(px + 2, py, TILE - 4, TILE);
        break;
      default:
        break;
    }
  },

  drawDiamond(x, y, color) {
    const ctx = this.ctx;
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
  },

  drawHero(e, base) {
    const ctx = this.ctx;
    ctx.fillStyle = base;
    this.roundRect(e.x, e.y, HERO_W, HERO_H, 6);
    ctx.fill();
    const face = e.vx < -8 ? -2 : e.vx > 8 ? 2 : 0; // 眼睛随移动方向微倾
    ctx.fillStyle = "#0b0f16";
    ctx.fillRect(e.x + 5 + face, e.y + 8, 4, 4);
    ctx.fillRect(e.x + HERO_W - 9 + face, e.y + 8, 4, 4);
    if (this.game.status === "dead") {
      ctx.strokeStyle = "#0b0f16";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x + 4, e.y + 6);
      ctx.lineTo(e.x + HERO_W - 4, e.y + HERO_H - 6);
      ctx.moveTo(e.x + HERO_W - 4, e.y + 6);
      ctx.lineTo(e.x + 4, e.y + HERO_H - 6);
      ctx.stroke();
    }
  },

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  showResult() {
    this.resultShown = true;
    const won = this.game.status === "won";
    const total = this.level.diamonds.length;
    this.setData({
      resultShow: true,
      resultTitle: won ? "通关！" : "失败！",
      resultDetail: won
        ? `用时 ${this.game.timer.toFixed(1)}s · 钻石 ${this.game.collected.size}/${total} · 失误 ${this.game.deaths}`
        : `失误 ${this.game.deaths}（点「重玩本关」再来）`,
      nextShow: won && this.index < LEVELS.length - 1,
    });
  },

  onRetry() {
    this.game.reset();
    this.resultShown = false;
    this.setData({ resultShow: false });
  },
  onNext() {
    if (this.index < LEVELS.length - 1) {
      wx.redirectTo({ url: "/pages/game/game?index=" + (this.index + 1) });
    }
  },
  onMenu() {
    wx.navigateBack();
  },
});
