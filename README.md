# 森林冰火人（Fireboy & Watergirl）

零依赖、无构建、无服务端的双人合作 Canvas 小游戏，依据 PRD `森林冰火人-v1.2` 实现。
H5 网页版 + 微信小程序版，共用同一套物理引擎与 10 关 ASCII 关卡。

## 运行

```bash
node scripts/serve.mjs        # 启动零依赖静态服务器（默认 8000）
# 浏览器打开 http://localhost:8000
```

> 必须用服务器打开（`type="module"` 不支持 `file://` 直接加载）。

## 验证可行性（关键）

```bash
node scripts/verify-levels.mjs   # 10 关全部在真实物理引擎中通关（20/20 项通过）
npm test                         # 13 条引擎单元测试（含 AC13 十关通关复算）
```

## 玩法

- 双人（键盘）：火人 `A`/`D` 移动、`W` 跳；水人 `←`/`→` 移动、`↑` 跳。
- 单人：`Tab` 切换操控对象。
- 手机 / 小程序：左右两侧虚拟按键，中间「切换」按钮。
- 非对称危害：火人怕水、水人怕岩浆、绿酸两者都怕；红蓝钻石只有同色角色能拾取；两人**同时**站进门才通关。
- 四种协作关卡：both-walkers / fire-holder / water-holder / relay（嵌套双协作）。

## 目录

- `src/engine/` — 纯逻辑引擎（常量 / 关卡解析 / 物理），无 DOM，可在 Node 测试。
- `src/levels/` — 10 关 ASCII 关卡（代码构建网格→转 ASCII，防手误）。
- `src/ui/main.js` — H5 主循环与渲染。
- `scripts/` — `verify-levels.mjs`（关卡验证器）、`strategy.mjs`（验证/测试共用策略）、`serve.mjs`（静态服务器）。
- `tests/` — `engine.test.mjs`（13 条单测）。
- `miniprogram/` — 微信小程序版（CommonJS 移植，同引擎同 10 关）。

## 许可证

MIT
