// 物理常量与关卡规格（来源：PRD §5.1 / §5.3）
// 所有数值严格对齐 PRD，禁止随意修改——它们是关卡可通关性的硬边界。

export const TILE = 32; // 格宽（px）
export const COLS = 25; // 关卡宽度（格）
export const ROWS = 16; // 关卡高度（格）
export const DT = 1 / 60; // 固定时间步长（s），与渲染解耦

export const HERO_W = 22; // 角色碰撞盒宽
export const HERO_H = 34; // 角色碰撞盒高

// 派生约束（PRD §5.1 红线）：台阶高差 ≤ 3 格（96px < 115px 跳跃高度），
// 水平跨度 ≤ 4 格（滞空 0.695s × 205px/s ≈ 140px）。
export const PHYS = {
  GRAVITY: 1900, // px/s² 下坠手感
  MAX_FALL: 900, // px/s 终端速度，防穿透
  MOVE_SPEED: 205, // px/s 水平最高速度
  ACCEL_GROUND: 2400, // 地面加速度
  ACCEL_AIR: 1500, // 空中加速度
  FRICTION: 2600, // 地面减速
  JUMP_VELOCITY: -660, // px/s 跳跃初速（跳跃高度 ≈ 115px ≈ 3.6 格）
  COYOTE: 0.09, // s 离台后仍可起跳的宽容时间
  JUMP_BUFFER: 0.10, // s 落地前提前按跳的缓存时间
};

export const CHARS = { FIRE: "fire", WATER: "water" };

// 危害矩阵（PRD §5.2）：岩浆 L / 水池 W / 绿酸 A
// L: 火安全、水致死；W: 火致死、水安全；A: 两者都致死。
export const HAZARD = { LAVA: "L", WATER: "W", ACID: "A" };

// 某危害格对某个角色是否致死
export function isLethal(tile, char) {
  if (tile === HAZARD.WATER) return char === CHARS.FIRE;
  if (tile === HAZARD.LAVA) return char === CHARS.WATER;
  if (tile === HAZARD.ACID) return true;
  return false;
}

// 角色出生点/门/板/钻石的字符集合（这些格本身可穿过，非实心）
export const TILE_KIND = {
  SOLID: "#",
  FIRE_SPAWN: "1",
  WATER_SPAWN: "2",
  FIRE_DOOR: "R",
  WATER_DOOR: "B",
  RED_DIAMOND: "r",
  BLUE_DIAMOND: "b",
  FIRE_PLATE: "-", // 火人压力板
  WATER_PLATE: "=", // 水人压力板
  G_DOOR: "g", // 受火板控制的门（为水人开）
  H_DOOR: "h", // 受水板控制的门（为火人开）
  AIR: ".",
};
