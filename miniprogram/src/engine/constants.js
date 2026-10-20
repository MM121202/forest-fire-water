// 物理常量与关卡规格（小程序版，CommonJS；与 H5 版保持一致）
const TILE = 32;
const COLS = 25;
const ROWS = 16;
const DT = 1 / 60;
const HERO_W = 22;
const HERO_H = 34;

const PHYS = {
  GRAVITY: 1900,
  MAX_FALL: 900,
  MOVE_SPEED: 205,
  ACCEL_GROUND: 2400,
  ACCEL_AIR: 1500,
  FRICTION: 2600,
  JUMP_VELOCITY: -660,
  COYOTE: 0.09,
  JUMP_BUFFER: 0.1,
};

const CHARS = { FIRE: "fire", WATER: "water" };
const HAZARD = { LAVA: "L", WATER: "W", ACID: "A" };

function isLethal(tile, char) {
  if (tile === HAZARD.WATER) return char === CHARS.FIRE;
  if (tile === HAZARD.LAVA) return char === CHARS.WATER;
  if (tile === HAZARD.ACID) return true;
  return false;
}

const TILE_KIND = {
  SOLID: "#",
  FIRE_SPAWN: "1",
  WATER_SPAWN: "2",
  FIRE_DOOR: "R",
  WATER_DOOR: "B",
  RED_DIAMOND: "r",
  BLUE_DIAMOND: "b",
  FIRE_PLATE: "-",
  WATER_PLATE: "=",
  G_DOOR: "g",
  H_DOOR: "h",
  AIR: ".",
};

module.exports = {
  TILE,
  COLS,
  ROWS,
  DT,
  HERO_W,
  HERO_H,
  PHYS,
  CHARS,
  HAZARD,
  isLethal,
  TILE_KIND,
};
