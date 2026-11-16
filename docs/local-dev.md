# 本地开发环境：主工程 + 子包联调

電脳麻将的主工程只负责 HTML/CSS/入口 JS，真正的引擎、AI、UI 都在三个 npm 子包里：

| 包 | 仓库 | 职责 |
|:--|:--|:--|
| `@kobalab/majiang-core` | kobalab/majiang-core | 牌山、配牌、摸打、和牌判定、向听、番数、局进行 |
| `@kobalab/majiang-ai` | kobalab/majiang-ai | 思考例程与 AI 开发工具 |
| `@kobalab/majiang-ui` | kobalab/majiang-ui | 牌桌/手牌渲染与交互 |

`node_modules` 里装的是这些包的**发布快照**。要能"改子包 → 主工程立刻生效 → 把改动提交回自己的 fork"，
就必须让依赖变成指向本地仓库的软链接，而不是快照拷贝。

## 目录布局

四个仓库平级放在同一个工作区根目录下：

```
<workspace>/
├── pnpm-workspace.yaml     # 把四个仓库登记成一个 workspace（关键）
├── Majiang/                # 本仓库（主工程）
├── majiang-core/           # 子包，可改、可提交
├── majiang-ai/
└── majiang-ui/
```

## 一次性安装

需要 pnpm（本机通过运行时自带的 node 调用 pnpm 的 mjs 入口）：

```bash
cd <workspace>
node <path-to-node> <path-to-pnpm.mjs> install --store-dir .pnpm-store
```

装完后 `Majiang/node_modules/@kobalab/majiang-*` 应该是指向同级目录的 **junction**：

```bash
cmd //c dir /AL "Majiang\node_modules\@kobalab"
# => <JUNCTION> majiang-core [<workspace>\majiang-core]
```

## 构建

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File <workspace>\build.ps1
```

产出在 `Majiang/dist/`（HTML/CSS/JS），用一个静态服务器指向它即可对局：

```bash
python -m http.server 8777 --bind 127.0.0.1 --directory Majiang/dist
```

改任意子包的 `lib/*.js` 后重跑构建，刷新浏览器就能看到效果。

## 这样搭踩到的坑（都已解决，改环境时别踩回去）
1. **不要用 `file:` 依赖。** pnpm 会把它装成快照拷贝（`symlink=false`），改本地仓库不生效。
   必须走 workspace + `linkWorkspacePackages: true`，依赖才会是链接。
2. **不要开 `shamefullyHoist`。** 它把所有包摊平成真实目录，连 workspace 的软链接一起摊掉。
3. **pnpm 11 不再读 `package.json` 的 `pnpm` 字段**，设置（overrides 等）要写在 `pnpm-workspace.yaml`。
4. **junction 的 `realpath` 解析不了。** pnpm 在 Windows 上用 junction（挂载点）做链接，
   而 Node / webpack 的 `realpath` 不会把它解析成真实路径，于是同一个 `majiang-core`
   会被当成两个模块：bundle 里打两份，`X instanceof Majiang.Player` 还会失效。
   构建脚本因此用 `resolve.alias` 把三个包钉到唯一的绝对路径。
5. **jQuery 会被打两份。** `majiang-ui` 自己的 `node_modules` 里也有一份 jquery，
   不 alias 的话主 bundle 会从 261 KiB 涨到 345 KiB，插件还可能挂到不同实例上。
   构建脚本里一并 alias 到主工程那一份。
6. **`webpack-cli` 的 shim 在 pnpm 严格布局下不可用**（`this.program.name` 报错），
   且 webpack 只作为 webpack-cli 的 peer 存在于 `.pnpm` 虚拟仓库里。
   构建脚本改用 webpack 的 Node API，并直接从 `.pnpm` 里解析 webpack。
7. 原项目的 `npm run release` 系列脚本会调用 `npm`，在没有 npm 的机器上不可用；
   本环境统一用上面的 `build.ps1`。
8. **`build.ps1` 必须保持纯 ASCII。** Windows PowerShell 5.1 会把无 BOM 的 `.ps1`
   当 ANSI 读，脚本里的中文路径会变成乱码、`Push-Location` 直接失败。
   路径用 `$PSScriptRoot` 拼接，注释也用英文。
9. **pug 必须是 3.x。** 作者在 `package.json` 里写了 `"overrides": {"pug": "^3.0.4"}`，
   但 pnpm 11 不读那个字段，于是装到 pug 2.0.4；pug 2 → `with` → `acorn-globals`
   要 acorn 4 的 `dist/walk`，在 pnpm 布局下会被 hoist 的 acorn 8 抢答，编译直接报
   `ERR_PACKAGE_PATH_NOT_EXPORTED`。解决办法是把这条 override 搬进 `pnpm-workspace.yaml`。

## 简中化

界面文案已整体改为简体中文，做法与词表：

- 词表：`tools/i18n/zh-cn.json`（原文 → 简中，含需要保护的规则键清单）
- 术语对照：`docs/glossary.md`（日文 → 简中，逐条标注代码出处）
- 只替换**给人看的文案**；`core/lib/rule.js` 的 28 个规则键是数据键，被 core / ai / ui /
  主工程四处引用并写进存档，保持日文不动，脚本里用带引号的占位符保护

改词表后重新应用的方式见工作区根目录的 `i18n/apply.js`（扫描 4 个仓库、按长词优先替换）。

## 子包改动的提交去向

主工程的 fork 是 `origin`，上游是 `upstream`。三个子包目前**只配了上游 remote**，
要提交子包的改动，需要先把它们各自 fork 一份，再：

```bash
git -C majiang-core remote add origin https://github.com/<you>/majiang-core.git
```

## 基线版本

本环境搭建时的版本（与上游发布版本一致，便于对照）：

- `Majiang` 2.5.4
- `majiang-core` 1.4.1
- `majiang-ai` 1.3.0
- `majiang-ui` 1.6.1
