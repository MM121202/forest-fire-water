// 10 关 ASCII 关卡（小程序版 CommonJS；与 H5 版 src/levels/index.js 同一套数据与几何）。
// 同步自 H5：firePlates/waterPlates 为数组；relay/holder 几何对齐验证过可通关的形态。
const { parseLevel } = require("../engine/level.js");

const COLS = 25;
const ROWS = 16;
const FLOOR_Y = 14;

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
function haz(g, x0, x1, ch) {
  for (let x = x0; x <= x1; x++) g[FLOOR_Y][x] = ch;
}
function put(g, cells) {
  for (const [x, y, c] of cells) g[y][x] = c;
}
function toAscii(g) {
  return g.map((r) => r.join("")).join("\n");
}
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

function buildL1() {
  return build("1·熔岩初探", { bg: ["#2a1208", "#120a06"], accent: "#ff7a3c", star: "#ffd9a0", mood: "熔岩洞窟" }, {
    type: "both-walkers", fireSpawn: 1, waterSpawn: 3, fireDoor: 22, waterDoor: 20,
    hazards: [[7, 8, "W"], [14, 15, "L"]],
    diamonds: [{ x: 10, y: 13, c: "red" }, { x: 18, y: 13, c: "red" }, { x: 6, y: 13, c: "blue" }, { x: 12, y: 13, c: "blue" }],
  });
}
function buildL2() {
  return build("2·寒冰回廊", { bg: ["#0a1830", "#050a16"], accent: "#5cc8ff", star: "#bfe6ff", mood: "寒冰回廊" }, {
    type: "fire-holder", fireSpawn: 1, waterSpawn: 3, firePlates: [6], fireDoor: 10, gDoors: [12], waterDoor: 20,
    hazards: [[16, 17, "L"]],
    diamonds: [{ x: 8, y: 13, c: "red" }, { x: 19, y: 13, c: "red" }, { x: 14, y: 13, c: "blue" }, { x: 4, y: 13, c: "blue" }],
  });
}
function buildL3() {
  return build("3·酸液深渊", { bg: ["#0c2410", "#06120a"], accent: "#39d36b", star: "#bff5cf", mood: "酸液深渊" }, {
    type: "both-walkers", fireSpawn: 1, waterSpawn: 3, fireDoor: 22, waterDoor: 20,
    hazards: [[9, 10, "A"], [14, 15, "W"], [18, 19, "L"]],
    diamonds: [{ x: 6, y: 13, c: "red" }, { x: 12, y: 13, c: "red" }, { x: 7, y: 13, c: "blue" }, { x: 16, y: 13, c: "blue" }],
  });
}
function buildL4() {
  return build("4·双生祭坛", { bg: ["#241026", "#120612"], accent: "#c46bff", star: "#ecd0ff", mood: "双生祭坛" }, {
    type: "water-holder", fireSpawn: 3, waterSpawn: 1, waterPlates: [6], waterDoor: 10, hDoors: [12], fireDoor: 22,
    hazards: [[16, 17, "W"]],
    diamonds: [{ x: 14, y: 13, c: "red" }, { x: 18, y: 13, c: "red" }, { x: 8, y: 13, c: "blue" }, { x: 20, y: 13, c: "blue" }],
  });
}
function buildL5() {
  return build("5·齿轮机关", { bg: ["#1a1c2e", "#0a0b16"], accent: "#ffb347", star: "#ffe2a8", mood: "齿轮机关" }, {
    type: "relay", fireSpawn: 8, waterSpawn: 2, gDoors: [6], firePlates: [10], waterPlates: [12], hDoors: [17], waterDoor: 16, fireDoor: 22,
    hazards: [[13, 14, "L"], [18, 19, "A"]],
    diamonds: [{ x: 9, y: 13, c: "red" }, { x: 20, y: 13, c: "red" }, { x: 5, y: 13, c: "blue" }, { x: 15, y: 13, c: "blue" }],
  });
}
function buildL6() {
  return build("6·镜像迷宫", { bg: ["#101a2e", "#060a16"], accent: "#7aa0ff", star: "#cdddff", mood: "镜像迷宫" }, {
    type: "both-walkers", fireSpawn: 1, waterSpawn: 3, fireDoor: 23, waterDoor: 21,
    hazards: [[6, 7, "W"], [9, 10, "L"], [12, 13, "A"], [15, 16, "W"], [18, 19, "L"]],
    diamonds: [{ x: 5, y: 13, c: "red" }, { x: 11, y: 13, c: "red" }, { x: 17, y: 13, c: "red" }, { x: 8, y: 13, c: "blue" }, { x: 14, y: 13, c: "blue" }, { x: 22, y: 13, c: "blue" }],
  });
}
function buildL7() {
  return build("7·烈焰试炼", { bg: ["#2a0e08", "#140604"], accent: "#ff6a3c", star: "#ffcaa0", mood: "烈焰试炼" }, {
    type: "fire-holder", fireSpawn: 1, waterSpawn: 3, firePlates: [5], fireDoor: 8, gDoors: [10], waterDoor: 23,
    hazards: [[12, 13, "L"], [16, 17, "A"], [20, 21, "L"]],
    diamonds: [{ x: 6, y: 13, c: "red" }, { x: 18, y: 13, c: "red" }, { x: 11, y: 13, c: "blue" }, { x: 22, y: 13, c: "blue" }],
  });
}
function buildL8() {
  return build("8·潮汐王座", { bg: ["#07203a", "#03101f"], accent: "#3aa0ff", star: "#aadcff", mood: "潮汐王座" }, {
    type: "water-holder", fireSpawn: 3, waterSpawn: 1, waterPlates: [5], waterDoor: 8, hDoors: [10], fireDoor: 23,
    hazards: [[12, 13, "W"], [16, 17, "A"], [20, 21, "W"]],
    diamonds: [{ x: 12, y: 13, c: "red" }, { x: 22, y: 13, c: "red" }, { x: 6, y: 13, c: "blue" }, { x: 18, y: 13, c: "blue" }],
  });
}
function buildL9() {
  return build("9·星界裂隙", { bg: ["#160a2e", "#08041a"], accent: "#9b6bff", star: "#d9c2ff", mood: "星界裂隙" }, {
    type: "relay", fireSpawn: 7, waterSpawn: 2, gDoors: [5], firePlates: [9], waterPlates: [12], hDoors: [17], waterDoor: 16, fireDoor: 22,
    hazards: [[13, 14, "L"], [18, 19, "A"]],
    diamonds: [{ x: 8, y: 13, c: "red" }, { x: 21, y: 13, c: "red" }, { x: 4, y: 13, c: "blue" }, { x: 15, y: 13, c: "blue" }],
  });
}
function buildL10() {
  return build("10·终焉神殿", { bg: ["#2a0820", "#140410"], accent: "#ff5a9e", star: "#ffc2e6", mood: "终焉神殿" }, {
    type: "relay", fireSpawn: 6, waterSpawn: 2, gDoors: [4], firePlates: [8], waterPlates: [11], hDoors: [17], waterDoor: 16, fireDoor: 22,
    hazards: [[12, 13, "L"], [18, 19, "A"]],
    diamonds: [{ x: 7, y: 13, c: "red" }, { x: 21, y: 13, c: "red" }, { x: 3, y: 13, c: "blue" }, { x: 15, y: 13, c: "blue" }],
  });
}

const LEVELS = [
  buildL1(), buildL2(), buildL3(), buildL4(), buildL5(),
  buildL6(), buildL7(), buildL8(), buildL9(), buildL10(),
];
module.exports = { LEVELS };
