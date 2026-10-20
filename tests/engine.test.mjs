// 引擎单元测试（PRD §8 AC1–AC13）。零依赖，用 node --test 运行。
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLevel } from "../src/engine/level.js";
import { Game } from "../src/engine/game.js";
import { TILE, HERO_W, HERO_H } from "../src/engine/constants.js";
import { LEVELS } from "../src/levels/index.js";

const IDLE = { left: false, right: false, jump: false };

function setOnTile(ent, tx, ty) {
  ent.x = tx * TILE + (TILE - HERO_W) / 2;
  ent.y = (ty + 1) * TILE - HERO_H;
}

// 构造 12×8 小关卡（strict:false），含所需全部要素用于规则测试
function buildTestLevel() {
  const W = 12;
  const H = 8;
  const g = Array.from({ length: H }, () => new Array(W).fill("."));
  for (let x = 0; x < W; x++) {
    g[6][x] = "#";
    g[7][x] = "#";
  }
  g[5][1] = "1"; // 火人出生
  g[5][3] = "2"; // 水人出生
  g[5][10] = "R"; // 火门
  g[5][9] = "B"; // 水门
  g[6][5] = "W"; // 水池（火致死/水安全）
  g[6][6] = "L"; // 岩浆（水致死/火安全）
  g[6][7] = "A"; // 绿酸（两者致死）
  g[5][4] = "-"; // 火板
  g[5][8] = "g"; // g 门（受火板控制）
  g[5][2] = "b"; // 蓝钻石
  g[5][0] = "r"; // 红钻石（保证红蓝对等）
  return parseLevel(
    "TEST",
    g.map((r) => r.join("")).join("\n"),
    { strict: false }
  );
}

test("AC2 行宽不一致立即抛错（不静默填充）", () => {
  // 16 行（满足行数），但最后一行宽度与其余不一致
  const rows = [];
  for (let i = 0; i < 15; i++) rows.push("##########");
  rows.push("####");
  const bad = rows.join("\n");
  assert.throws(() => parseLevel("BAD", bad), /宽度不一致/);
});

test("AC1 关卡尺寸与钻石对等（取 L1）", () => {
  const lvl = LEVELS[0];
  assert.equal(lvl.w, 25);
  assert.equal(lvl.h, 16);
  const red = lvl.diamonds.filter((d) => d.color === "red").length;
  const blue = lvl.diamonds.filter((d) => d.color === "blue").length;
  assert.equal(red, blue);
  assert.ok(lvl.fire && lvl.water && lvl.fireDoor && lvl.waterDoor);
});

test("AC3 火人站水池 → 失败（deathReason fire/water）", () => {
  const game = new Game(buildTestLevel());
  setOnTile(game.fire, 5, 5); // 站在 (5,6) 水池上方
  const st = game.step({ fire: IDLE, water: IDLE });
  assert.equal(st, "dead");
  assert.equal(game.deathReason.fire.hazard, "W");
});

test("AC4 水人站水池 → 仍在游戏中", () => {
  const game = new Game(buildTestLevel());
  setOnTile(game.water, 5, 5);
  const st = game.step({ fire: IDLE, water: IDLE });
  assert.equal(st, "playing");
});

test("AC5 水人站岩浆 → 失败", () => {
  const game = new Game(buildTestLevel());
  setOnTile(game.water, 6, 5);
  const st = game.step({ fire: IDLE, water: IDLE });
  assert.equal(st, "dead");
  assert.equal(game.deathReason.water.hazard, "L");
});

test("AC6 火人碰蓝钻石 → 不被拾取（颜色锁定）", () => {
  const game = new Game(buildTestLevel());
  setOnTile(game.fire, 2, 5); // 蓝钻石格
  game.step({ fire: IDLE, water: IDLE });
  assert.equal(game.fire.collected.blue, 0);
});

test("AC7 只有一人到门 → 未通关", () => {
  const game = new Game(buildTestLevel());
  setOnTile(game.fire, 10, 5); // 火门
  setOnTile(game.water, 3, 5); // 水人不在门内
  const st = game.step({ fire: IDLE, water: IDLE });
  assert.notEqual(st, "won");
});

test("AC8 两人同时到门 → 通关", () => {
  const game = new Game(buildTestLevel());
  setOnTile(game.fire, 10, 5); // 火门
  setOnTile(game.water, 9, 5); // 水门
  const st = game.step({ fire: IDLE, water: IDLE });
  assert.equal(st, "won");
});

test("AC9 火板未踩 → g 门为实心（关闭）", () => {
  const game = new Game(buildTestLevel());
  setOnTile(game.fire, 1, 5); // 不在火板上
  game._updateMechanisms();
  assert.equal(game.gOpen, false);
});

test("AC10 火板被踩 → g 门可穿过（开启）", () => {
  const game = new Game(buildTestLevel());
  setOnTile(game.fire, 4, 5); // 火板格
  game._updateMechanisms();
  assert.equal(game.gOpen, true);
});

test("AC11 角色在门格内且板松开 → 门不关合（防夹）", () => {
  const game = new Game(buildTestLevel());
  setOnTile(game.fire, 8, 5); // g 门格内
  setOnTile(game.water, 3, 5);
  game._updateMechanisms();
  assert.equal(game.gOpen, true); // 防夹：强制保持开启
});

test("AC12 同一输入序列跑两次 → 完全一致（确定性）", () => {
  const mk = () => {
    const g = new Game(LEVELS[0]);
    for (let i = 0; i < 150; i++) {
      g.step({
        fire: { left: false, right: true, jump: false },
        water: { left: false, right: true, jump: false },
      });
    }
    return g;
  };
  const a = mk();
  const b = mk();
  assert.equal(a.fire.x, b.fire.x);
  assert.equal(a.fire.y, b.fire.y);
  assert.equal(a.water.x, b.water.x);
  assert.equal(a.water.y, b.water.y);
  assert.equal(a.status, b.status);
});

test("AC13 十关验证器全部可通关（真实物理 playthrough）", async () => {
  // 复用验证器同源策略 scripts/strategy.mjs（纯函数、无 process.exit 副作用），
  // 避免测试与验证器各写一份策略而漂移——这正是历史 bug 的根因。
  const { simulate, PLANS } = await import("../scripts/strategy.mjs");
  for (const lvl of LEVELS) {
    const plan = PLANS[lvl.name];
    assert.ok(plan, `${lvl.name} 缺少模拟方案`);
    const r = simulate(lvl, plan);
    const why = r.dead ? "death:" + JSON.stringify(r.reason) : "timeout";
    assert.equal(r.won, true, `${lvl.name} 应可通关（${why}）`);
  }
});
