// 物理引擎核心（小程序版 CommonJS；与 H5 版一致，零依赖、可 Node 验证）
const {
  TILE,
  DT,
  HERO_W,
  HERO_H,
  PHYS,
  CHARS,
  HAZARD,
  isLethal,
} = require("./constants.js");
const { tileAt } = require("./level.js");

const INSET = 6;

function makeEntity(char, spawn) {
  const feetY = (spawn.y + 1) * TILE;
  return {
    char,
    x: spawn.x * TILE + (TILE - HERO_W) / 2,
    y: feetY - HERO_H,
    vx: 0,
    vy: 0,
    onGround: false,
    coyote: 0,
    jumpBuf: 0,
    collected: { red: 0, blue: 0 },
  };
}

function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function Game(level, opts) {
  opts = opts || {};
  this.level = level;
  this.deaths = 0;
  this.forcePressed = opts.forcePressed || { fire: false, water: false };
  this.reset();
}

Game.prototype.reset = function () {
  this.fire = makeEntity(CHARS.FIRE, this.level.fire);
  this.water = makeEntity(CHARS.WATER, this.level.water);
  this.status = "playing";
  this.timer = 0;
  this.deathReason = null;
  this.collected = new Set();
  this.gOpen = false;
  this.hOpen = false;
  this._updateMechanisms();
};

Game.prototype._pressedPlates = function () {
  const self = this;
  const fireOn = (tx, ty) =>
    aabbOverlap(
      self.fire.x, self.fire.y, HERO_W, HERO_H,
      tx * TILE + INSET, ty * TILE + INSET, TILE - 2 * INSET, TILE - 2 * INSET
    );
  const waterOn = (tx, ty) =>
    aabbOverlap(
      self.water.x, self.water.y, HERO_W, HERO_H,
      tx * TILE + INSET, ty * TILE + INSET, TILE - 2 * INSET, TILE - 2 * INSET
    );
  return {
    firePlate: this.level.firePlates.some((p) => fireOn(p.x, p.y)),
    waterPlate: this.level.waterPlates.some((p) => waterOn(p.x, p.y)),
  };
};

Game.prototype._entityInDoorTile = function (entity, doors) {
  const cx = entity.x + HERO_W / 2;
  const cy = entity.y + HERO_H / 2;
  return doors.some((d) =>
    aabbOverlap(cx - 1, cy -1, 2, 2, d.x * TILE, d.y * TILE, TILE, TILE)
  );
};

Game.prototype._updateMechanisms = function () {
  const { firePlate, waterPlate } = this._pressedPlates();
  const gPressed = this.forcePressed.fire || firePlate;
  const hPressed = this.forcePressed.water || waterPlate;
  const fireInG = this._entityInDoorTile(this.fire, this.level.gDoors);
  const waterInG = this._entityInDoorTile(this.water, this.level.gDoors);
  const fireInH = this._entityInDoorTile(this.fire, this.level.hDoors);
  const waterInH = this._entityInDoorTile(this.water, this.level.hDoors);
  this.gOpen = gPressed || fireInG || waterInG;
  this.hOpen = hPressed || fireInH || waterInH;
};

Game.prototype._solid = function (tx, ty) {
  const t = tileAt(this.level.grid, tx, ty);
  if (t === "#") return true;
  if (t === HAZARD.LAVA || t === HAZARD.WATER || t === HAZARD.ACID) return true;
  if (t === "g") return !this.gOpen;
  if (t === "h") return !this.hOpen;
  return false;
};

Game.prototype._resolveX = function (e) {
  const dx = e.vx * DT;
  e.x += dx;
  if (dx === 0) return;
  const top = Math.floor(e.y / TILE);
  const bottom = Math.floor((e.y + HERO_H - 1) / TILE);
  const left = Math.floor(e.x / TILE);
  const right = Math.floor((e.x + HERO_W - 1) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (this._solid(tx, ty)) {
        if (dx > 0) e.x = Math.min(e.x, tx * TILE - HERO_W);
        else e.x = Math.max(e.x, (tx + 1) * TILE);
        e.vx = 0;
      }
    }
  }
};

Game.prototype._resolveY = function (e) {
  const dy = e.vy * DT;
  e.y += dy;
  e.onGround = false;
  if (dy === 0) return;
  const left = Math.floor(e.x / TILE);
  const right = Math.floor((e.x + HERO_W - 1) / TILE);
  const top = Math.floor(e.y / TILE);
  const bottom = Math.floor((e.y + HERO_H - 1) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (this._solid(tx, ty)) {
        if (dy > 0) {
          e.y = Math.min(e.y, ty * TILE - HERO_H);
          e.onGround = true;
        } else {
          e.y = Math.max(e.y, (ty + 1) * TILE);
        }
        e.vy = 0;
      }
    }
  }
};

Game.prototype._stepEntity = function (e, input) {
  const onGroundPrev = e.onGround;
  const left = !!input.left;
  const right = !!input.right;
  if (left !== right) {
    const dir = left ? -1 : 1;
    const accel = onGroundPrev ? PHYS.ACCEL_GROUND : PHYS.ACCEL_AIR;
    e.vx += dir * accel * DT;
    if (e.vx > PHYS.MOVE_SPEED) e.vx = PHYS.MOVE_SPEED;
    if (e.vx < -PHYS.MOVE_SPEED) e.vx = -PHYS.MOVE_SPEED;
  } else if (onGroundPrev) {
    if (e.vx > 0) e.vx = Math.max(0, e.vx - PHYS.FRICTION * DT);
    else e.vx = Math.min(0, e.vx + PHYS.FRICTION * DT);
  }

  if (input.jump) e.jumpBuf = PHYS.JUMP_BUFFER;
  else e.jumpBuf = Math.max(0, e.jumpBuf - DT);
  if (e.jumpBuf > 0 && (onGroundPrev || e.coyote > 0)) {
    e.vy = PHYS.JUMP_VELOCITY;
    e.onGround = false;
    e.coyote = 0;
    e.jumpBuf = 0;
  }

  e.vy += PHYS.GRAVITY * DT;
  if (e.vy > PHYS.MAX_FALL) e.vy = PHYS.MAX_FALL;

  this._resolveX(e);
  this._resolveY(e);

  if (e.onGround) e.coyote = PHYS.COYOTE;
  else e.coyote = Math.max(0, e.coyote - DT);
};

Game.prototype._hazardKill = function (e) {
  const ax = e.x - 1, ay = e.y - 1, aw = HERO_W + 2, ah = HERO_H + 2;
  const left = Math.floor(ax / TILE);
  const right = Math.floor((ax + aw - 1) / TILE);
  const top = Math.floor(ay / TILE);
  const bottom = Math.floor((ay + ah - 1) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      const t = tileAt(this.level.grid, tx, ty);
      if (
        (t === HAZARD.LAVA || t === HAZARD.WATER || t === HAZARD.ACID) &&
        isLethal(t, e.char)
      ) {
        return t;
      }
    }
  }
  return null;
};

Game.prototype._collectDiamonds = function (e) {
  const cx = e.x + HERO_W / 2;
  const cy = e.y + HERO_H / 2;
  const tx = Math.floor(cx / TILE);
  const ty = Math.floor(cy / TILE);
  for (const d of this.level.diamonds) {
    if (d.x === tx && d.y === ty) {
      const key = d.x + "," + d.y;
      if (this.collected.has(key)) continue;
      const match =
        (d.color === "red" && e.char === CHARS.FIRE) ||
        (d.color === "blue" && e.char === CHARS.WATER);
      if (match) {
        this.collected.add(key);
        e.collected[d.color]++;
      }
    }
  }
};

Game.prototype._centerInDoor = function (e, door) {
  const cx = e.x + HERO_W / 2;
  const cy = e.y + HERO_H / 2;
  return Math.floor(cx / TILE) === door.x && Math.floor(cy / TILE) === door.y;
};

Game.prototype.step = function (input) {
  if (this.status !== "playing") return this.status;
  const fireIn = input.fire || {};
  const waterIn = input.water || {};
  this._updateMechanisms();
  this._stepEntity(this.fire, fireIn);
  this._stepEntity(this.water, waterIn);

  const fk = this._hazardKill(this.fire);
  const wk = this._hazardKill(this.water);
  if (fk || wk) {
    this.status = "dead";
    this.deaths++;
    this.deathReason = {
      fire: fk ? { kind: this.fire.char, hazard: fk } : null,
      water: wk ? { kind: this.water.char, hazard: wk } : null,
    };
    return this.status;
  }
  this._collectDiamonds(this.fire);
  this._collectDiamonds(this.water);
  if (
    this._centerInDoor(this.fire, this.level.fireDoor) &&
    this._centerInDoor(this.water, this.level.waterDoor)
  ) {
    this.status = "won";
  }
  this.timer += DT;
  return this.status;
};

module.exports = { Game, makeEntity, aabbOverlap };
