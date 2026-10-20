// 10 关 ASCII 关卡（PRD §5.3）。用代码构建 25×16 网格后再转 ASCII，
// 既保证尺寸严格一致，又仍走 parseLevel 的 ASCII 解析流程（faithful to PRD）。
//
// 协作模型（严格对齐引擎语义）：
//   L 岩浆：水致死 / 火安全（火可踩、水必须跳）
//   W 水池：火致死 / 水安全（水可踩、火必须跳）
//   A 绿酸：两者都致死（都必须跳）
//   - 火板 开 全部 g 门（为水人开）   = 水板 开 全部 h 门（为火人开）
//   R 火门 / B 水门：各自终点，需两人同时站在自己门内才算通关。
//
// 四种关卡原型：
//   both-walkers : 两人均向右奔向自己的门，跳过各自致死的危害。
//   fire-holder  : 火人踩火板开 g 门让水人通过，之后火人去自己门。
//   water-holder : 水人踩水板开 h 门让火人通过，之后水人去自己门。
//   relay        : 嵌套双协作——火板开 g 放水人进中区，水板开 h 放火人进右区，
//                  两人各跨一道由对方控制的门，最终各回各家（无死锁）。
//
// 几何护栏（保证可被验证器策略证明可通关）：
//   - 压力板前后 ≥1 格净空，且板前不紧贴危害（停靠点不与起跳点冲突）；
//   - 角色终点门在「其路径末段危害」之后保留 ≥2 格落地跑道（走进门，而非跳落进门）；
//   - 连锁危害之间 ≥2 格间隙（支持稳定连锁跳）。
import { parseLevel } from "../engine/level.js";

const COLS = 25;
const ROWS = 16;
const FLOOR_Y = 14; // 地面在倒数第二行，y=13 为可站立的“地表”行

function blankGrid() {
  const g = [];
  for (let y = 0; y < ROWS; y++) g.push(new Array(COLS).fill("."));
  return g;
}

function setFloor(g) {
  for (let x = 0; x < COLS; x++) {
    g[FLOOR_Y][x] = "#";
    g[FLOOR_Y + 1][x] = "#";
  }
}

// 在地面行铺一段危害（x0..x1 闭区间）
function haz(g, x0, x1, ch) {
  for (let x = x0; x <= x1; x++) g[FLOOR_Y][x] = ch;
}

function put(g, cells) {
  for (const [x, y, c] of cells) g[y][x] = c;
}

function toAscii(g) {
  return g.map((r) => r.join("")).join("\n");
}

// 统一构建器
function build(name, theme, spec) {
  const g = blankGrid();
  setFloor(g);
  for (const [x0, x1, ch] of spec.hazards || []) haz(g, x0, x1, ch);
  const cells = [
    [spec.fireSpawn, 13, "1"],
    [spec.waterSpawn, 13, "2"],
    [spec.fireDoor, 13, "R"],
    [spec.waterDoor, 13, "B"],
  ];
  for (const p of spec.firePlates || []) cells.push([p, 13, "-"]);
  for (const p of spec.waterPlates || []) cells.push([p, 13, "="]);
  for (const d of spec.gDoors || []) cells.push([d, 13, "g"]);
  for (const d of spec.hDoors || []) cells.push([d, 13, "h"]);
  for (const d of spec.diamonds || []) cells.push([d.x, d.y, d.c === "red" ? "r" : "b"]);
  put(g, cells);
  const lvl = parseLevel(name, toAscii(g));
  lvl.theme = theme;
  lvl.type = spec.type;
  return lvl;
}

// ────────────────────────────────────────────────────────────
// 关卡 1 · 熔岩初探（both-walkers）：教火人躲水、水人躲岩浆
// ────────────────────────────────────────────────────────────
function buildL1() {
  return build(
    "1·熔岩初探",
    { bg: ["#2a1208", "#120a06"], accent: "#ff7a3c", star: "#ffd9a0", mood: "熔岩洞窟" },
    {
      type: "both-walkers",
      fireSpawn: 1,
      waterSpawn: 3,
      fireDoor: 22,
      waterDoor: 20,
      hazards: [
        [7, 8, "W"], // 水池：火致死，火必须跳；水安全可踏
        [14, 15, "L"], // 岩浆：水致死，水必须跳；火安全可踏
      ],
      diamonds: [
        { x: 10, y: 13, c: "red" },
        { x: 18, y: 13, c: "red" },
        { x: 6, y: 13, c: "blue" },
        { x: 12, y: 13, c: "blue" },
      ],
    }
  );
}

// ────────────────────────────────────────────────────────────
// 关卡 2 · 寒冰回廊（fire-holder）：火人踩板开水门，水人过门还要跳岩浆
// ────────────────────────────────────────────────────────────
function buildL2() {
  return build(
    "2·寒冰回廊",
    { bg: ["#0a1830", "#050a16"], accent: "#5cc8ff", star: "#bfe6ff", mood: "寒冰回廊" },
    {
      type: "fire-holder",
      fireSpawn: 1,
      waterSpawn: 3,
      firePlates: [6],
      fireDoor: 10,
      gDoors: [12],
      waterDoor: 20,
      hazards: [[16, 17, "L"]], // 水人路径上的岩浆，须跳
      diamonds: [
        { x: 8, y: 13, c: "red" },
        { x: 19, y: 13, c: "red" },
        { x: 14, y: 13, c: "blue" },
        { x: 4, y: 13, c: "blue" },
      ],
    }
  );
}

// ────────────────────────────────────────────────────────────
// 关卡 3 · 酸液深渊（both-walkers + 绿酸）：两人都要跳的“共死”危害
// ────────────────────────────────────────────────────────────
function buildL3() {
  return build(
    "3·酸液深渊",
    { bg: ["#0c2410", "#06120a"], accent: "#39d36b", star: "#bff5cf", mood: "酸液深渊" },
    {
      type: "both-walkers",
      fireSpawn: 1,
      waterSpawn: 3,
      fireDoor: 22,
      waterDoor: 20,
      hazards: [
        [9, 10, "A"], // 绿酸：两人都致死
        [14, 15, "W"], // 水可踏、火须跳
        [18, 19, "L"], // 火可踏、水须跳
      ],
      diamonds: [
        { x: 6, y: 13, c: "red" },
        { x: 12, y: 13, c: "red" },
        { x: 7, y: 13, c: "blue" },
        { x: 16, y: 13, c: "blue" },
      ],
    }
  );
}

// ────────────────────────────────────────────────────────────
// 关卡 4 · 双生祭坛（water-holder）：水人踩板开 h 门，火人过门还要跳水
// ────────────────────────────────────────────────────────────
function buildL4() {
  return build(
    "4·双生祭坛",
    { bg: ["#241026", "#120612"], accent: "#c46bff", star: "#ecd0ff", mood: "双生祭坛" },
    {
      type: "water-holder",
      fireSpawn: 3,
      waterSpawn: 1,
      waterPlates: [6],
      waterDoor: 10,
      hDoors: [12],
      fireDoor: 22,
      hazards: [[16, 17, "W"]], // 火人路径上的水池，须跳
      diamonds: [
        { x: 14, y: 13, c: "red" },
        { x: 18, y: 13, c: "red" },
        { x: 8, y: 13, c: "blue" },
        { x: 20, y: 13, c: "blue" },
      ],
    }
  );
}

// ────────────────────────────────────────────────────────────
// 关卡 5 · 齿轮机关（relay 嵌套双协作）：
//   火板开 g 放水人进中区 → 水板开 h 放火人进右区 → 各回我家
//   几何：水门在水危害(L@13-14)后 2 格；火门在火危害(A@18-19)后 3 格；h 门紧贴火危害前。
// ────────────────────────────────────────────────────────────
function buildL5() {
  return build(
    "5·齿轮机关",
    { bg: ["#1a1c2e", "#0a0b16"], accent: "#ffb347", star: "#ffe2a8", mood: "齿轮机关" },
    {
      type: "relay",
      fireSpawn: 8, // 火人在中区
      waterSpawn: 2, // 水人在左区
      gDoors: [6], // 左↔中 边界，受火板控制
      firePlates: [10], // 火板在中区
      waterPlates: [12], // 水板在中区
      hDoors: [17], // 中↔右 边界，受水板控制
      waterDoor: 16, // 水门在中区（水人不跨 h），位于 L@13-14 之后 2 格
      fireDoor: 22, // 火门在右区（火人跨 h），位于 A@18-19 之后 3 格
      hazards: [
        [13, 14, "L"], // 中区水人须跳的岩浆
        [18, 19, "A"], // 右区火人须跳的绿酸
      ],
      diamonds: [
        { x: 9, y: 13, c: "red" },
        { x: 20, y: 13, c: "red" },
        { x: 5, y: 13, c: "blue" },
        { x: 15, y: 13, c: "blue" },
      ],
    }
  );
}

// ────────────────────────────────────────────────────────────
// 关卡 6 · 镜像迷宫（both-walkers 密集危害）：五段交替危害考验节奏
// ────────────────────────────────────────────────────────────
function buildL6() {
  return build(
    "6·镜像迷宫",
    { bg: ["#101a2e", "#060a16"], accent: "#7aa0ff", star: "#cdddff", mood: "镜像迷宫" },
    {
      type: "both-walkers",
      fireSpawn: 1,
      waterSpawn: 3,
      fireDoor: 23,
      waterDoor: 21,
      hazards: [
        [6, 7, "W"],
        [9, 10, "L"],
        [12, 13, "A"],
        [15, 16, "W"],
        [18, 19, "L"],
      ],
      diamonds: [
        { x: 5, y: 13, c: "red" },
        { x: 11, y: 13, c: "red" },
        { x: 17, y: 13, c: "red" },
        { x: 8, y: 13, c: "blue" },
        { x: 14, y: 13, c: "blue" },
        { x: 22, y: 13, c: "blue" },
      ],
    }
  );
}

// ────────────────────────────────────────────────────────────
// 关卡 7 · 烈焰试炼（fire-holder）：水人三段连锁危害（段间 ≥2 格）长程
// ────────────────────────────────────────────────────────────
function buildL7() {
  return build(
    "7·烈焰试炼",
    { bg: ["#2a0e08", "#140604"], accent: "#ff6a3c", star: "#ffcaa0", mood: "烈焰试炼" },
    {
      type: "fire-holder",
      fireSpawn: 1,
      waterSpawn: 3,
      firePlates: [5],
      fireDoor: 8,
      gDoors: [10],
      waterDoor: 23,
      hazards: [
        [12, 13, "L"], // 段间 14-15 净空 ≥2
        [16, 17, "A"], // 段间 18-19 净空 ≥2
        [20, 21, "L"], // 门在 22，末段后跑道 22
      ],
      diamonds: [
        { x: 6, y: 13, c: "red" },
        { x: 18, y: 13, c: "red" },
        { x: 11, y: 13, c: "blue" },
        { x: 22, y: 13, c: "blue" },
      ],
    }
  );
}

// ────────────────────────────────────────────────────────────
// 关卡 8 · 潮汐王座（water-holder）：火人三段连锁危害（段间 ≥2 格）长程
// ────────────────────────────────────────────────────────────
function buildL8() {
  return build(
    "8·潮汐王座",
    { bg: ["#07203a", "#03101f"], accent: "#3aa0ff", star: "#aadcff", mood: "潮汐王座" },
    {
      type: "water-holder",
      fireSpawn: 3,
      waterSpawn: 1,
      waterPlates: [5],
      waterDoor: 8,
      hDoors: [10],
      fireDoor: 23,
      hazards: [
        [12, 13, "W"],
        [16, 17, "A"],
        [20, 21, "W"],
      ],
      diamonds: [
        { x: 12, y: 13, c: "red" },
        { x: 22, y: 13, c: "red" },
        { x: 6, y: 13, c: "blue" },
        { x: 18, y: 13, c: "blue" },
      ],
    }
  );
}

// ────────────────────────────────────────────────────────────
// 关卡 9 · 星界裂隙（relay 进阶）：中区岩浆 + 右区绿酸
// ────────────────────────────────────────────────────────────
function buildL9() {
  return build(
    "9·星界裂隙",
    { bg: ["#160a2e", "#08041a"], accent: "#9b6bff", star: "#d9c2ff", mood: "星界裂隙" },
    {
      type: "relay",
      fireSpawn: 7,
      waterSpawn: 2,
      gDoors: [5],
      firePlates: [9],
      waterPlates: [12],
      hDoors: [17],
      waterDoor: 16,
      fireDoor: 22,
      hazards: [
        [13, 14, "L"], // 中区水人须跳
        [18, 19, "A"], // 右区火人须跳（绿酸两人致死）
      ],
      diamonds: [
        { x: 8, y: 13, c: "red" },
        { x: 21, y: 13, c: "red" },
        { x: 4, y: 13, c: "blue" },
        { x: 15, y: 13, c: "blue" },
      ],
    }
  );
}

// ────────────────────────────────────────────────────────────
// 关卡 10 · 终焉神殿（relay 终极）：双门双板 + 中区岩浆/右区绿酸，收官大关
//   几何对齐 L9 验证过的形态：水门在水危害后 2 格、火门在火危害后 3 格。
// ────────────────────────────────────────────────────────────
function buildL10() {
  return build(
    "10·终焉神殿",
    { bg: ["#2a0820", "#140410"], accent: "#ff5a9e", star: "#ffc2e6", mood: "终焉神殿" },
    {
      type: "relay",
      fireSpawn: 6,
      waterSpawn: 2,
      gDoors: [4],
      firePlates: [8],
      waterPlates: [11],
      hDoors: [17],
      waterDoor: 16,
      fireDoor: 22,
      hazards: [
        [12, 13, "L"], // 中区水人须跳（水门 16 在其后 3 格跑道）
        [18, 19, "A"], // 右区火人须跳
      ],
      diamonds: [
        { x: 7, y: 13, c: "red" },
        { x: 21, y: 13, c: "red" },
        { x: 3, y: 13, c: "blue" },
        { x: 15, y: 13, c: "blue" },
      ],
    }
  );
}

export const LEVELS = [
  buildL1(), buildL2(), buildL3(), buildL4(), buildL5(),
  buildL6(), buildL7(), buildL8(), buildL9(), buildL10(),
];
export {
  buildL1, buildL2, buildL3, buildL4, buildL5,
  buildL6, buildL7, buildL8, buildL9, buildL10,
};
