# 改一条规则的标准流程

从"收到规则"到"提交"的固定路径，按这个走能把一次改动从 5~8 分钟压到 1~2 分钟。

## 第 0 步：先分类

| 类型 | 例子 | 影响面 | 验证方式 |
|:--|:--|:--|:--|
| **A. 数值** | 碰硬张 4 胡改 6 胡 | `rule.js` 一行 | `.\check.ps1` |
| **B. 新台 / 新腊子** | 加"门风刻子 1 台" | `rule.js` + `score.js` 一行 | `.\check.ps1` |
| **C. 当花 / 配牌** | 白板当花、闹闹中发白当花 | `shan.js` + `game.js` + `score.js` | `.\check.ps1` + 开一局看 |
| **D. 和牌型 / 向听** | 加七对、改面子数 | `hule.js` + `shanten.js` + AI | `.\check.ps1 -Full` |
| **E. 流程** | 连庄、流局、鸣牌 | `game.js` | `check.ps1` + `record-test` |
| **F. 界面** | 高亮、面板、按钮 | `wenling.js` + `.pug` | `--only=wenling` + 截图 |

先分类，再动手 —— 分类错了会改一堆无关文件。

## 第 1 步：能放进规则表就放规则表

`lib/rule.js` 是唯一的数值来源。引擎代码里**不应该出现魔法数字**。

```js
/* rule.js */
'碰中发台': 1,
```

```js
/* score.js —— 只读表，不写死 */
add('碰中发', n * (rule['碰中发台'] ?? 0));
```

好处：以后调数值只改一行，`rules-test` 里断言还能跟着变。

## 第 2 步：A/B 类改法（最常见）

1. `lib/rule.js` 加/改键
2. `lib/score.js` 的 `tai_list()` 或 `lazi_list()` 加一行 `add(...)`
3. `dev/rules-test.js` 加断言
4. `.\check.ps1`（3 秒）

断言写法（照抄即可）：

```js
const r = Score.score({ ...base, mianzi: [...base.mianzi, kezi('z7')] });
ok('碰中计 1 台', (r.tai_list.find(x => x.name === '中发白刻子') || {}).tai === 1,
   JSON.stringify(r.tai_list));
```

## 第 3 步：C 类（当花/配牌）—— 两处必须同步

配牌走 `shan.js`，摸牌走 `game.js`，**两边判断逻辑必须一致**：

```js
/* shan.js::qipai */
const is_baiban = p => { ... };

/* game.js */
_is_baiban(p) { ... }
```

改完必查：

- `check.ps1`（含"手牌无残留白板/中发白"、"张数守恒 144"）
- 开一局看花牌区是否显示（`白板×2 发×1 中×3`）
- 台数：`score.js` 里 baiban 分种类计数
- 胡头：`base_hutou()` 里 baiban 也按花算 4 胡

## 第 4 步：D 类（和牌型）—— 最重，必须跑 AI

`hule.js` 改了分解方式，`shanten.js` 也得跟着改（否则 AI 判断和牌能力会崩）。

```
1. hule.js   分解逻辑
2. shanten.js 向听（跟 hule 保持一致）
3. score.js  对应的牌型台
4. .\check.ps1 -Full      ← AI 基准，200 秒，跑完看胜局数不能掉
```

**并且**：引擎行为一变，老的牌谱就对不上了。要么 bump `record.js` 的 `version`，要么接受"老牌谱回放会抛错"。

## 第 5 步：E 类（流程）—— 记得跨局状态

`game.js` 只管一局。跨局（连庄/下庄）靠这两处：

```js
/* 界面 */
next_state = { zhuang: game.zhuang, jushu: game.jushu, changbang: game.changbang };
start(undefined, next_state);

/* 引擎 */
new Game(rule, policy, { seed, ...state });
```

改流程后**必须**跑：

- `check.ps1`（`game-test` 覆盖流局/连庄/配牌张数）
- `record-test.js`（回放一致性）

## 第 6 步：F 类（界面）

```powershell
node Majiang\tools\build.js --only=wenling      # 1 秒
```

- 页面元素 id 一律 `#wl-*`（`#board` 会被主 CSS 隐藏）
- 改完刷新页面，看右上角构建号变了没有
- 截图确认一次即可

## 第 7 步：提交清单

- [ ] `.\check.ps1` 通过
- [ ] 动了 AI / 和牌型 → `.\check.ps1 -Full` 通过
- [ ] 动了引擎 → 跑一次全量 `.\build.ps1`（约 14 秒，否则界面还是旧的）
- [ ] 页面构建号已更新
- [ ] `README.md` 的规则表同步
- [ ] 引擎改动提交到 `majiang-wenling`，界面改动提交到 `Majiang`
- [ ] 两个仓库都 `push`

## 踩过的坑（改之前先看一眼）

| 坑 | 现象 | 对策 |
|:--|:--|:--|
| PowerShell 5.1 按 ANSI 读无 BOM 脚本 | 中文路径变乱码、脚本报错 | `.ps1` 只写 ASCII，中文走 `edit`/`write` 工具 |
| 浏览器缓存同名 bundle | 改了代码看不到变化 | 构建会给 js 打 `?v=<构建号>` |
| 改了引擎没重建 | 界面行为不变 | 引擎改动后必须全量 build |
| 牌谱记录不带开局场次 | 连庄后的回放错位 | `make_record` 要存 `state` |
| 配牌固定发给 P0 | 换庄后 18 张 | `qipai(rule, seed, dealer)` 传庄家座位 |
| 分析函数在真实手牌上 remove/add | 手牌顺序乱跳 | 一律在 `hand.clone()` 上算 |

## 耗时参考

| 步骤 | 耗时 |
|:--|--:|
| 改 `rule.js` + `score.js` | 30 秒 |
| `check.ps1` | 3 秒 |
| 全量构建 | 14 秒 |
| 单页构建 | 1 秒 |
| `check.ps1 -Full` | 200 秒 |
| 提交 + 推送 | 5 秒 |

一条 A/B 类规则：**约 1 分钟**。D 类（和牌型）：**约 5 分钟**（AI 基准占大头）。
