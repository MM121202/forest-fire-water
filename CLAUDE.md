# CLAUDE.md

本文件为 AI 助手提供项目速览。人类说明请看 `README.md`，可行性结论看 `可行性测试报告.md`，代码审查看 `代码审查报告.md`。

## 项目是什么
「森林冰火人」双人合作平台跳跃小游戏，依据 PRD v1.2 实现。**零依赖、无构建、无服务端**。两个形态共用同一套物理引擎与 10 关：
- **H5 网页版**：ES Module + Canvas 2D，键盘双人 + Pointer 多指触屏 + 单人 Tab 切换。
- **微信小程序版**：CommonJS 移植（同引擎同关卡），Canvas 2D + 左右虚拟按键。

## 命令（都用 npm）
```bash
npm run serve     # 零依赖静态服务器，默认 8000，浏览器开 http://localhost:8000
npm run verify    # 关卡验证器：真实物理引擎跑 10 关，必须 20/20 通过
npm test          # 引擎单测（node --test），必须 13/13 通过
npm run package   # 用 node 脚本零依赖打包成 forest-fire-water-v<version>.zip
```
- ESM 不能用 `file://` 打开，必须经 `serve`。
- `npm test` 的脚本是 `node --test "tests/**/*.test.mjs"`（**不要**写成 `node --test tests/`，本机 Node 22 会把目录当模块而失败）。

## 目录结构
```
src/engine/{constants,level,game}.js   纯逻辑引擎：固定 1/60s 步长+累加器、扫描式逐轴碰撞、
                                       危害=实心+接触即致死（岩浆L/水池W/绿酸A，非对称致死）。无 DOM，可 Node 直跑。
src/levels/index.js                    10 关，代码构建 25×16 网格再转 ASCII，仍走 parseLevel 解析。
src/ui/main.js                         H5 主循环 + 输入合并 + Canvas 渲染 + 菜单/结算。
scripts/verify-levels.mjs              关卡验证器（真实物理 playthrough + 协作可达性）。
scripts/strategy.mjs                   验证器与单测【共用】的纯策略模块（navTo/holdAt/relayInput/simulate/PLANS）。
scripts/serve.mjs                      零依赖静态服务器。
scripts/package.mjs                    零依赖 ZIP 打包（node:zlib 手写，中文名带 UTF-8 标志位）。
tests/engine.test.mjs                  AC1–AC13 单测。
miniprogram/                           小程序版：src/ 为 CJS 引擎+关卡，pages/{index,game} 为 UI。
```

## 硬约定（改动前必读）
1. **H5(ESM) 与 miniprogram(CJS) 的引擎与关卡必须保持一致**。改关卡要同步 `src/levels/index.js` 与 `miniprogram/src/levels/index.js`，并复跑两端。
2. **每关必须能被 `npm run verify` 证明可通关**（验证器是 PRD 北极星：让陌生人独立回答"能不能通关"）。新增/改关卡后必须 20/20。
3. **关卡几何护栏**（否则验证策略过不了）：
   - 压力板用数组键 `firePlates:[n]` / `waterPlates:[n]`（**不要**用单数 `firePlate:n`，历史 bug：build() 只读复数键，单数会导致板不生成、关卡不可通关）。
   - 压力板前后留净空、终点门在末段危害后 ≥2 格落地跑道、连锁危害间距 ≥2 格。
   - `formatCheck` 有结构断言：有 g 门必有火板、有 h 门必有水板、relay 需火板+水板+g门+h门齐备。
4. **护栏**：单文件 ≤600 行、H5 源码 ≤3500 行、首屏 ≤200KB、零依赖零构建。
5. 四种关卡原型：`both-walkers` / `fire-holder` / `water-holder` / `relay`（嵌套双协作）。

## 环境坑（本机 win32 + Git Bash）
- 无 `zip`/`7z`；GNU tar 不能打 `.zip` 且会把 `C:` 当远程主机。打包一律走 `npm run package`（node 脚本）。
- PowerShell `Compress-Archive`(PS5.1) 不给中文名打 UTF-8 标志、进度输出污染捕获——别用它打包。
- 校验 zip 用 `unzip -l` 或 Python `zipfile`；`namelist()` 在部分终端显示的中文乱码只是捕获假象，以落盘文件名为准。
- Node 用受管版本：`C:\Users\Lenovo\.workbuddy\binaries\node\versions\22.22.2\node.exe`（或直接 `node`/`npm`）。

## 版本
当前 `1.3.0`（package.json）。已通过一轮代码审查并修复 3 个阻断级缺陷 + 若干 P1/P2。
