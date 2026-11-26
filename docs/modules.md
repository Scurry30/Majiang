# 温岭麻将 模块索引

改一个规则时按这张表定位，不用再全仓库找。
具体改法见 [changing-rules.md](changing-rules.md)。

## 引擎 `majiang-wenling/lib/`

| 文件 | 管什么 | 关键导出 |
|:--|:--|:--|
| `pai.js` | 144 张牌的定义、牌种编号、硬张/花牌判断、排序 | `KINDS`、`KIND_INDEX`、`is_hard`、`is_flower`、`FLOWER_SEAT`、`FLOWER_NAME`、`sort_key` |
| `rule.js` | **所有规则的默认值**（台数、胡头、腊子、连庄、当花…） | `rule()` |
| `shan.js` | 洗牌、配牌（庄家 17 张）、翻财神、补花、白板/闹闹当花 | `Shan`、`qipai` |
| `shoupai.js` | 手牌 + 副露：计数、财神张数、能否碰/杠、食替、可打牌列表 | `Shoupai`、`can_pon`、`can_gang`、`dapai_list`、`counts` |
| `hule.js` | 和牌判定（5 面子 + 1 将，财神万能）、双财神作将识别 | `hule`、`tingpai`、`is_double_joker_pair` |
| `score.js` | 胡头、台数、腊子、结算、闲家两两差额 | `score`、`settle`、`base_hutou`、`tai_list`、`lazi_list`、`hutou_of_hand` |
| `game.js` | 一局流程：摸打、吃碰杠、和牌、流局、连庄/下庄、庄家轮转 | `Game` |
| `shanten.js` | 向听数 DFS、有效牌张数 | `shanten`、`ukeire` |
| `ai.js` | 牌效评估、候选打牌、牌效分析（给界面用） | `analyze`、`effective_tiles`、`select_dapai`、`create_policy` |
| `record.js` | 牌谱：seed + 决策、回放、状态快照 | `make_record`、`replay_game`、`state_of` |
| `index.js` | 统一出口 | 全部 |

## 界面 `Majiang/src/`

| 文件 | 管什么 |
|:--|:--|
| `js/wenling.js` | 对局页：渲染、点击交互、训练模式、牌效面板、结算面板 |
| `html/page/wenling.pug` | 对局页结构 + 全部内联 CSS（`.pai`、`.seat`、`#wl-tips`…） |
| `js/wenling-replay.js` | 牌谱回放 + 逐手牌效评分 |
| `html/page/wenling-replay.pug` | 回放页结构与样式 |
| `js/wenling-stats.js` | 统计画像（跨局汇总） |
| `html/page/wenling-stats.pug` | 统计页结构与样式 |
| `js/ruleset.js` | 规则选择页 |
| `tools/build.js` | webpack 构建（含 `--only=<entry>` 增量构建、时间戳注入） |

## 改一类需求要动哪里

| 需求类型 | 要动的地方 | 说明 |
|:--|:--|:--|
| **改台数/胡头数值** | `lib/rule.js` 一处 | 数值全在规则表里，代码不用动 |
| **加一条新台** | `rule.js` 加键 + `score.js::tai_list()` 加一行 + `rules-test.js` | 半天工作量变十几行 |
| **加一条新腊子** | `rule.js` 加键 + `score.js::lazi_list()` | 同上 |
| **改和牌型（如加七对）** | `hule.js` 分解逻辑 + `score.js` 台 + `shanten.js` 向听 | 最重的一类，会牵动 AI |
| **改摸打流程** | `game.js::run()` | 牵动牌谱回放，改完要跑 `record-test` |
| **改配牌/当花** | `shan.js::qipai()` + `game.js::_is_baiban()` | 两处必须一致 |
| **改交互/显示** | `js/wenling.js` + `page/wenling.pug` | 只影响界面，构建用 `--only=wenling` |
| **改回放/统计** | `js/wenling-replay.js` / `js/wenling-stats.js` | 依赖 `record.state_of()` 的快照字段 |
| **AI 变强** | `ai.js` + `shanten.js` | 改完必须跑 `ai-test.js`（200 秒） |

## 一局的流程（改 game.js 前先看这个）

```
kaiju()  配牌 → 翻财神 → 补花
run()
  └ 循环：摸牌(_draw) → 打牌(dapai) → 鸣牌判定(_claim: 和/杠/碰/吃) → 下一家
  └ 和牌(_hule) → 算分(score) → 连庄/下庄
  └ 流局(_pingju) → 庄家连庄 + 本场 +1
```

## 快慢两档

| 操作 | 耗时 | 用在什么时候 |
|:--|--:|:--|
| `.\check.ps1` | ~1 秒 | 每次改完立刻验证 |
| `.\check.ps1 -Full` | ~200 秒 | 动了 AI / 提交前 |
| `node tools/build.js --only=wenling` | ~1 秒 | 只改了界面 |
| `.\build.ps1`（全量） | ~14 秒 | 提交前 |
