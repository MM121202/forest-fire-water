// 关卡验证策略（PRD §8 AC13/AC14）：真实物理引擎 + 策略驱动 playthrough。
// 本模块为「纯函数、无副作用」，同时供 scripts/verify-levels.mjs 与
// tests/engine.test.mjs 复用，避免两份策略漂移（历史 bug：单测曾各自复刻导致失效）。
//
// 关键设计：
//   - navTo 的起跳护栏：仅当「前方 ≤2 格内有致死危害 且 该危害位于目标之前」才跳，
//     避免为躲「目标之后的危害」而跳过一个必须停靠的点（压力板/门）——这是 relay 死锁的根因。
//   - holdAt 停靠板时朝板列回正，防止摩擦滑行冲出板格导致「松板」。
import { Game } from "../src/engine/game.js";
import { TILE, HERO_W, HERO_H, isLethal, CHARS } from "../src/engine/constants.js";
import { tileAt } from "../src/engine/level.js";

export const MAX_TICKS = 60 * 90; // 上限 90s 模拟

export const centerCol = (e) => Math.floor((e.x + HERO_W / 2) / TILE);
const footRow = (e) => Math.floor((e.y + HERO_H) / TILE);
export const idle = () => ({ left: false, right: false, jump: false });

// 向右导航到 targetCol；落且前方 ≤2 格有「位于目标之前的」致死危害则起跳。
export function navTo(game, e, char, targetCol) {
  if (centerCol(e) >= targetCol) return idle();
  const base = Math.floor((e.x + HERO_W / 2) / TILE);
  const row = footRow(e);
  const needJump =
    e.onGround &&
    [base + 1, base + 2].some(
      (c) => c < targetCol && isLethal(tileAt(game.level.grid, c, row), char)
    );
  return { left: false, right: true, jump: needJump };
}

// 守板：接近并停靠在压力板列；越过则轻微左移回正（不起跳，避免冲过末段危害）。
export function holdAt(game, e, char, plateCol) {
  const c = centerCol(e);
  if (c < plateCol) return navTo(game, e, char, plateCol);
  if (c > plateCol) return { left: true, right: false, jump: false };
  return idle();
}

// 守者：队友未到位前踩板驻留，到位后去自己门。
export function holderInput(game, e, char, plateCol, doorCol, otherDone) {
  if (!otherDone) return holdAt(game, e, char, plateCol);
  return centerCol(e) >= doorCol ? idle() : navTo(game, e, char, doorCol);
}

export function isAtCharDoor(game, char) {
  const e = char === CHARS.FIRE ? game.fire : game.water;
  const door = char === CHARS.FIRE ? game.level.fireDoor : game.level.waterDoor;
  return centerCol(e) >= door.x;
}

// relay 控制器：火板开 g 放水人进中区 → 水板开 h 放火人进右区 → 各回各家（无死锁）。
export function relayInput(game, char) {
  const waterPlate = game.level.waterPlates[0];
  const firePlate = game.level.firePlates[0];
  if (!waterPlate || !firePlate) return idle(); // 结构不良时优雅退出，避免崩溃
  const waterAtPlate = centerCol(game.water) >= waterPlate.x;
  const fireAtDoor = centerCol(game.fire) >= game.level.fireDoor.x;
  if (char === CHARS.FIRE) {
    // 火人：水人未踩水板前踩火板（开 g 放水人进中区）；之后跨 h 去火门。
    if (!waterAtPlate) return holdAt(game, game.fire, CHARS.FIRE, firePlate.x);
    return navTo(game, game.fire, CHARS.FIRE, game.level.fireDoor.x);
  }
  // 水人：先跨 g 去水板；就位后踩水板（开 h）等火人到门；最后去水门。
  if (!waterAtPlate) return navTo(game, game.water, CHARS.WATER, waterPlate.x);
  if (!fireAtDoor) return holdAt(game, game.water, CHARS.WATER, waterPlate.x);
  return navTo(game, game.water, CHARS.WATER, game.level.waterDoor.x);
}

// 双角色联合模拟，返回 { won, ticks, deaths } 或失败原因。
export function simulate(level, plan) {
  const game = new Game(level);
  for (let i = 0; i < MAX_TICKS; i++) {
    let fireIn, waterIn;
    if (plan.type === "both-walkers") {
      fireIn = navTo(game, game.fire, CHARS.FIRE, plan.fireDoor);
      waterIn = navTo(game, game.water, CHARS.WATER, plan.waterDoor);
    } else if (plan.type === "fire-holder") {
      const otherDone = isAtCharDoor(game, CHARS.WATER);
      fireIn = holderInput(game, game.fire, CHARS.FIRE, plan.firePlate, plan.fireDoor, otherDone);
      waterIn = navTo(game, game.water, CHARS.WATER, plan.waterDoor);
    } else if (plan.type === "water-holder") {
      const otherDone = isAtCharDoor(game, CHARS.FIRE);
      waterIn = holderInput(game, game.water, CHARS.WATER, plan.waterPlate, plan.waterDoor, otherDone);
      fireIn = navTo(game, game.fire, CHARS.FIRE, plan.fireDoor);
    } else {
      fireIn = relayInput(game, CHARS.FIRE);
      waterIn = relayInput(game, CHARS.WATER);
    }
    const st = game.step({ fire: fireIn, water: waterIn });
    if (st === "won") return { won: true, ticks: i + 1, deaths: game.deaths };
    if (st === "dead")
      return { won: false, dead: true, reason: game.deathReason, ticks: i + 1 };
  }
  return { won: false, timeout: true, ticks: MAX_TICKS };
}

// 协作可达性（AC14）：假定队友踩板(forcePressed)，单角色能否到达自己的门。
export function reachabilityCheck(level, char, forceKey) {
  const game = new Game(level, { forcePressed: { fire: false, water: false } });
  game.forcePressed[forceKey] = true;
  const e = char === CHARS.FIRE ? game.fire : game.water;
  const door = char === CHARS.FIRE ? level.fireDoor : level.waterDoor;
  for (let i = 0; i < MAX_TICKS; i++) {
    const inp = navTo(game, e, char, door.x);
    const st = game.step({
      fire: char === CHARS.FIRE ? inp : idle(),
      water: char === CHARS.WATER ? inp : idle(),
    });
    if (st === "won" || st === "dead") return { ok: st === "won", status: st };
    if (centerCol(e) >= door.x) return { ok: true, status: "reached" };
  }
  return { ok: false, status: "timeout" };
}

// 每关模拟方案。relay 的门/板关系由引擎内部推导，只需标类型。
export const PLANS = {
  "1·熔岩初探": { type: "both-walkers", fireDoor: 22, waterDoor: 20 },
  "2·寒冰回廊": { type: "fire-holder", firePlate: 6, fireDoor: 10, waterDoor: 20 },
  "3·酸液深渊": { type: "both-walkers", fireDoor: 22, waterDoor: 20 },
  "4·双生祭坛": { type: "water-holder", waterPlate: 6, waterDoor: 10, fireDoor: 22 },
  "5·齿轮机关": { type: "relay" },
  "6·镜像迷宫": { type: "both-walkers", fireDoor: 23, waterDoor: 21 },
  "7·烈焰试炼": { type: "fire-holder", firePlate: 5, fireDoor: 8, waterDoor: 23 },
  "8·潮汐王座": { type: "water-holder", waterPlate: 5, waterDoor: 8, fireDoor: 23 },
  "9·星界裂隙": { type: "relay" },
  "10·终焉神殿": { type: "relay" },
};
