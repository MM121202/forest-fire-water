// 关卡验证器（PRD §8 AC1/AC2/AC13/AC14）：真实物理引擎 + 策略驱动 playthrough。
// 证明「这游戏真能通关」：用真实引擎跑出两人同时到门的结论，而非听我说。
//
// 用法：node scripts/verify-levels.mjs
// 策略与单测共用 scripts/strategy.mjs，避免两份漂移。
import { LEVELS } from "../src/levels/index.js";
import {
  PLANS,
  simulate,
  reachabilityCheck,
} from "./strategy.mjs";
import { CHARS } from "../src/engine/constants.js";

// 格式 + 结构自洽校验（AC1/AC2 + 结构 lint，堵住「板/门不配套」类错误）
function formatCheck(level) {
  if (level.w !== 25 || level.h !== 16)
    throw new Error(`尺寸不是 25×16（${level.w}×${level.h}）`);
  const red = level.diamonds.filter((d) => d.color === "red").length;
  const blue = level.diamonds.filter((d) => d.color === "blue").length;
  if (red !== blue) throw new Error(`红蓝钻石不等 ${red}/${blue}`);

  const type = level.type;
  const need = (cond, msg) => {
    if (!cond) throw new Error(`结构与 type=${type} 不符：${msg}`);
  };
  // 有 g 门 ⇒ 必须有火板；有 h 门 ⇒ 必须有水板
  if (level.gDoors.length) need(level.firePlates.length > 0, "有 g 门但无火板");
  if (level.hDoors.length) need(level.waterPlates.length > 0, "有 h 门但无水板");
  if (type === "fire-holder") {
    need(level.firePlates.length > 0 && level.gDoors.length > 0, "缺火板或 g 门");
  }
  if (type === "water-holder") {
    need(level.waterPlates.length > 0 && level.hDoors.length > 0, "缺水板或 h 门");
  }
  if (type === "relay") {
    need(
      level.firePlates.length > 0 &&
        level.waterPlates.length > 0 &&
        level.gDoors.length > 0 &&
        level.hDoors.length > 0,
      "relay 需火板+水板+g门+h门齐备"
    );
  }
  return true;
}

let pass = 0;
let fail = 0;
console.log("=== 森林冰火人 · 关卡验证器（真实物理引擎）===\n");

for (const level of LEVELS) {
  process.stdout.write(`[格式] ${level.name}: `);
  try {
    formatCheck(level);
    console.log("OK (25×16, 红蓝钻石对等, 结构自洽)");
    pass++;
  } catch (e) {
    console.log("FAIL — " + e.message);
    fail++;
    continue;
  }

  const plan = PLANS[level.name] || { type: level.type };
  const r = simulate(level, plan);
  if (r.won) {
    console.log(
      `[通关] ${level.name}: 两人同时到门 ✓ (用时 ${(r.ticks / 60).toFixed(1)}s, 失误 ${r.deaths})`
    );
    pass++;
  } else if (r.dead) {
    console.log(
      `[通关] ${level.name}: ✗ 失败 @tick ${r.ticks} reason=${JSON.stringify(r.reason)}`
    );
    fail++;
  } else {
    console.log(`[通关] ${level.name}: ✗ 超时未通关`);
    fail++;
  }

  // 协作可达性（AC14）
  const hasGate = level.gDoors.length > 0 || level.hDoors.length > 0;
  if (hasGate) {
    // 假定队友踩板：火人路径需 h 开（forceKey=water），水人路径需 g 开（forceKey=fire）
    const fk = reachabilityCheck(level, CHARS.FIRE, "water");
    const wk = reachabilityCheck(level, CHARS.WATER, "fire");
    console.log(
      `       协作可达性(假定队友踩板): 火人=${fk.status} 水人=${wk.status}`
    );
  }
  console.log("");
}

console.log(`=== 结果: ${pass} 项通过, ${fail} 项失败 ===`);
process.exit(fail === 0 ? 0 : 1);
