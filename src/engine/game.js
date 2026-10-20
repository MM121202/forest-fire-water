// 物理引擎核心：纯逻辑、零依赖、无 DOM，可在 Node 中直接驱动测试与验证器。
// 设计目标（PRD §6 D1/D2）：固定 1/60s 步长 + 累加器；扫描式逐轴碰撞防 1px 穿透。
import {
  TILE,
  DT,
  HERO_W,
  HERO_H,
  PHYS,
  CHARS,
  HAZARD,
  isLethal,
} from "./constants.js";
import { tileAt } from "./level.js";

const INSET = 6; // 压力板内缩判定（角色盒与格子内缩区域重叠才算踩住）

function makeEntity(char, spawn) {
  const feetY = (spawn.y + 1) * TILE; // 站在出生点下方一格的地面上
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

export class Game {
  constructor(level, opts = {}) {
    this.level = level;
    this.deaths = 0; // 失误数（跨重开保留）
    this.forcePressed = opts.forcePressed || { fire: false, water: false };
    this.reset();
  }

  reset() {
    this.fire = makeEntity(CHARS.FIRE, this.level.fire);
    this.water = makeEntity(CHARS.WATER, this.level.water);
    this.status = "playing"; // playing | won | dead
    this.timer = 0;
    this.deathReason = null;
    this.collected = new Set(); // "x,y" 已拾取钻石
    this.gOpen = false;
    this.hOpen = false;
    // 首帧基于出生点计算一次门/板状态，避免第一帧踩空
    this._updateMechanisms();
  }

  _pressedPlates() {
    const fireOn = (tx, ty) =>
      aabbOverlap(
        this.fire.x,
        this.fire.y,
        HERO_W,
        HERO_H,
        tx * TILE + INSET,
        ty * TILE + INSET,
        TILE - 2 * INSET,
        TILE - 2 * INSET
      );
    const waterOn = (tx, ty) =>
      aabbOverlap(
        this.water.x,
        this.water.y,
        HERO_W,
        HERO_H,
        tx * TILE + INSET,
        ty * TILE + INSET,
        TILE - 2 * INSET,
        TILE - 2 * INSET
      );
    const firePlate = this.level.firePlates.some((p) => fireOn(p.x, p.y));
    const waterPlate = this.level.waterPlates.some((p) => waterOn(p.x, p.y));
    return { firePlate, waterPlate };
  }

  _entityInDoorTile(entity, doors) {
    const cx = entity.x + HERO_W / 2;
    const cy = entity.y + HERO_H / 2;
    return doors.some((d) => {
      const dx = d.x * TILE;
      const dy = d.y * TILE;
      return aabbOverlap(cx - 1, cy - 1, 2, 2, dx, dy, TILE, TILE);
    });
  }

  // 更新压力板与门的开合（含防夹：门格内有角色则强制开启）
  _updateMechanisms() {
    const { firePlate, waterPlate } = this._pressedPlates();
    const gPressed = this.forcePressed.fire || firePlate;
    const hPressed = this.forcePressed.water || waterPlate;
    // 防夹：任一角色处于门格内，该门强制开启（PRD §5.5）
    const fireInG = this._entityInDoorTile(this.fire, this.level.gDoors);
    const waterInG = this._entityInDoorTile(this.water, this.level.gDoors);
    const fireInH = this._entityInDoorTile(this.fire, this.level.hDoors);
    const waterInH = this._entityInDoorTile(this.water, this.level.hDoors);
    this.gOpen = gPressed || fireInG || waterInG;
    this.hOpen = hPressed || fireInH || waterInH;
  }

  _solid(tx, ty) {
    const t = tileAt(this.level.grid, tx, ty);
    if (t === "#") return true;
    if (t === HAZARD.LAVA || t === HAZARD.WATER || t === HAZARD.ACID) return true;
    if (t === "g") return !this.gOpen;
    if (t === "h") return !this.hOpen;
    return false;
  }

  _resolveX(e) {
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
  }

  _resolveY(e) {
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
  }

  _stepEntity(e, input) {
    const onGroundPrev = e.onGround;
    // 水平加速 / 摩擦
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

    // 跳跃（缓冲 + 土狼时间，基于上一帧着地状态）
    if (input.jump) e.jumpBuf = PHYS.JUMP_BUFFER;
    else e.jumpBuf = Math.max(0, e.jumpBuf - DT);
    if (e.jumpBuf > 0 && (onGroundPrev || e.coyote > 0)) {
      e.vy = PHYS.JUMP_VELOCITY;
      e.onGround = false;
      e.coyote = 0;
      e.jumpBuf = 0;
    }

    // 重力
    e.vy += PHYS.GRAVITY * DT;
    if (e.vy > PHYS.MAX_FALL) e.vy = PHYS.MAX_FALL;

    this._resolveX(e);
    this._resolveY(e);

    // 更新土狼时间
    if (e.onGround) e.coyote = PHYS.COYOTE;
    else e.coyote = Math.max(0, e.coyote - DT);
  }

  _hazardKill(e) {
    // 用膨胀 1px 的盒检测「接触即致死」（站立/贴墙都算接触）
    const ax = e.x - 1;
    const ay = e.y - 1;
    const aw = HERO_W + 2;
    const ah = HERO_H + 2;
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
  }

  _collectDiamonds(e) {
    const cx = e.x + HERO_W / 2;
    const cy = e.y + HERO_H / 2;
    const tx = Math.floor(cx / TILE);
    const ty = Math.floor(cy / TILE);
    for (const d of this.level.diamonds) {
      if (d.x === tx && d.y === ty) {
        const key = `${d.x},${d.y}`;
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
  }

  _centerInDoor(e, door) {
    const cx = e.x + HERO_W / 2;
    const cy = e.y + HERO_H / 2;
    return (
      Math.floor(cx / TILE) === door.x && Math.floor(cy / TILE) === door.y
    );
  }

  // 推进一帧。input: { fire:{left,right,jump}, water:{left,right,jump} }
  step(input) {
    if (this.status !== "playing") return this.status;

    const fireIn = input.fire || {};
    const waterIn = input.water || {};

    this._updateMechanisms();

    this._stepEntity(this.fire, fireIn);
    this._stepEntity(this.water, waterIn);

    // 危害判定（接触即死）
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

    // 钻石拾取（颜色锁定）
    this._collectDiamonds(this.fire);
    this._collectDiamonds(this.water);

    // 通关：两人同时站在各自门内
    if (
      this._centerInDoor(this.fire, this.level.fireDoor) &&
      this._centerInDoor(this.water, this.level.waterDoor)
    ) {
      this.status = "won";
    }

    this.timer += DT;
    return this.status;
  }
}

export { makeEntity, aabbOverlap };
