// 关卡解析（小程序版，CommonJS；与 H5 版一致）
const { COLS, ROWS, TILE_KIND } = require("./constants.js");

function parseLevel(name, ascii, opts) {
  opts = opts || {};
  const strict = opts.strict !== false;
  let lines = ascii.replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

  if (strict && lines.length !== ROWS) {
    throw new Error(`[${name}] 行数不一致：期望 ${ROWS}，实际 ${lines.length}`);
  }
  const w = lines[0].length;
  for (let y = 0; y < lines.length; y++) {
    if (lines[y].length !== w) {
      throw new Error(`[${name}] 第 ${y} 行宽度不一致：期望 ${w}，实际 ${lines[y].length}`);
    }
  }
  if (strict && w !== COLS) {
    throw new Error(`[${name}] 列数不一致：期望 ${COLS}，实际 ${w}`);
  }

  const grid = lines.map((l) => l.split(""));
  const h = grid.length;
  const level = {
    name,
    grid,
    w,
    h,
    fire: null,
    water: null,
    fireDoor: null,
    waterDoor: null,
    diamonds: [],
    firePlates: [],
    waterPlates: [],
    gDoors: [],
    hDoors: [],
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = grid[y][x];
      switch (c) {
        case TILE_KIND.FIRE_SPAWN: level.fire = { x, y }; break;
        case TILE_KIND.WATER_SPAWN: level.water = { x, y }; break;
        case TILE_KIND.FIRE_DOOR: level.fireDoor = { x, y }; break;
        case TILE_KIND.WATER_DOOR: level.waterDoor = { x, y }; break;
        case TILE_KIND.RED_DIAMOND: level.diamonds.push({ x, y, color: "red" }); break;
        case TILE_KIND.BLUE_DIAMOND: level.diamonds.push({ x, y, color: "blue" }); break;
        case TILE_KIND.FIRE_PLATE: level.firePlates.push({ x, y }); break;
        case TILE_KIND.WATER_PLATE: level.waterPlates.push({ x, y }); break;
        case TILE_KIND.G_DOOR: level.gDoors.push({ x, y }); break;
        case TILE_KIND.H_DOOR: level.hDoors.push({ x, y }); break;
        default: break;
      }
    }
  }

  if (!level.fire || !level.water) throw new Error(`[${name}] 缺少火人/水人出生点`);
  if (!level.fireDoor || !level.waterDoor) throw new Error(`[${name}] 缺少火门/水门`);
  const redCount = level.diamonds.filter((d) => d.color === "red").length;
  const blueCount = level.diamonds.filter((d) => d.color === "blue").length;
  if (redCount !== blueCount)
    throw new Error(`[${name}] 红蓝钻石数量不等：红 ${redCount} / 蓝 ${blueCount}`);

  return level;
}

function tileAt(grid, x, y) {
  if (y < 0) return TILE_KIND.AIR;
  if (x < 0 || x >= grid[0].length || y >= grid.length) return TILE_KIND.SOLID;
  return grid[y][x];
}

module.exports = { parseLevel, tileAt };
