/*!
 *  温岭麻将 —— 浏览器对局界面
 *
 *  引擎在 majiang-wenling 包里；这里只做「把状态画出来 + 把点击变成决策」。
 *  人类固定坐 P0，其余三家是随机策略的机器人。
 */
"use strict";

const Wenling = require('majiang-wenling');

const NAME = ['东', '南', '西', '北'];
const rule = Wenling.rule();

let game    = null;
let pending = null;          // 当前等待玩家回答的问题

/* ---------- 小工具 ---------- */

function pai(p, cls = '') {
    return `<img class="pai ${cls}" src="img/${p}.gif" alt="${p}" data-tile="${p}">`;
}
function back(n) {
    return '<span class="pai back"></span>'.repeat(n);
}
function btn(label, act, extra = '') {
    return `<button data-act="${act}" ${extra}>${label}</button>`;
}

/* ---------- 渲染 ---------- */

/* 中央那行提示：现在轮到谁 / 刚打了什么 */
function turn_text() {
    if (! game) return '';
    if (pending && pending.kind === 'dapai') return '轮到你出牌';

    const last = game.log[game.log.length - 1];
    if (! last) return '';

    if (last.action === '打') {
        const who = last.player === 0 ? '你' : NAME[game.menfeng(last.player)] + '家';
        return `${who} 打出 ${tile_name(last.detail)}`;
    }
    if (last.action === '碰' || last.action === '吃' || last.action === '杠'
            || last.action === '暗杠' || last.action === '加杠') {
        const who = last.player === 0 ? '你' : NAME[game.menfeng(last.player)] + '家';
        return `${who} ${last.action}`;
    }
    if (last.action === '和牌') return '本局结束';
    if (last.action === '流局') return '流局';
    return '';
}

function seat(l) {
    const h    = game.hands[l];
    const name = NAME[game.menfeng(l)] + (l === game.zhuang ? '（庄）' : '');

    const kuikae = (l === 0) ? h.kuikae : null;
    /* 手牌按牌种排序显示，保证每次摸打后位置稳定不跳 */
    const tiles = h.pai.slice().sort((a, b) =>
        Wenling.Pai.sort_key(a) - Wenling.Pai.sort_key(b));
    const hand = l === 0
        ? tiles.map(p => {
              const cls = (p === kuikae) ? 'disabled'
                        : (pending && pending.kind === 'dapai' ? 'selectable' : '');
              return pai(p, cls);
          }).join('')
        : back(h.shoupaishu);

    const flowers = h.flowers.map(f => Wenling.Pai.FLOWER_NAME[f]).join('');
    const bb      = h.baiban || [];
    const n_bai   = bb.filter(p => p === 'z5').length;
    const n_fa    = bb.filter(p => p === 'z6').length;
    const baiban  = (n_bai ? ` 白板×${n_bai}` : '') + (n_fa ? ` 发×${n_fa}` : '');
    const melds   = h.fulou.map(m => m.tiles.map(t => pai(t)).join('')).join(' ');

    /* 刚打出的那张牌加高亮，谁在出牌也标出来 */
    const last   = game.log[game.log.length - 1];
    const acting = last && last.action === '打' && last.player === l;
    const he = game.he[l].map((p, i) =>
        pai(p, acting && i === game.he[l].length - 1 ? 'just' : '')).join('');

    return `<div class="label ${acting ? 'acting' : ''}">${acting ? '▶ ' : ''}${name}${l === 0 ? '' : ' · ' + h.shoupaishu + ' 张'}</div>
            <div class="hand">${hand}</div>
            <div class="flowers">${flowers ? '花：' + flowers : ''}${baiban}</div>
            <div class="melds">${melds}</div>
            <div class="he">${he}</div>`;
}

function actions() {
    if (! pending) return '';

    const p = pending;
    const img = t => `<img class="pai" src="img/${t}.gif" alt="${t}">`;

    if (p.kind === 'dapai')    return '<span class="hint">点击你要打出的牌</span>';
    if (p.kind === 'hu')       return btn(`和牌 ${p.tile ? img(p.tile) : ''}`, 'yes') + btn('过', 'no');
    if (p.kind === 'pon')      return btn(`碰 ${img(p.tile)}`, 'yes') + btn('过', 'no');
    if (p.kind === 'gang')     return btn(`杠 ${img(p.tile)}`, 'yes') + btn('过', 'no');
    if (p.kind === 'both')     return btn(`杠 ${img(p.tile)}`, 'gang_yes')
                                    + btn(`碰 ${img(p.tile)}`, 'pon_yes') + btn('过', 'no');

    if (p.kind === 'chi') {
        return p.options.map((o, i) =>
            `<button data-act="chi" data-i="${i}">吃 ${img(o[0])}${img(o[1])}${img(p.tile)}</button>`
        ).join('') + btn('过', 'no');
    }

    if (p.kind === 'self_gang') {
        const a = p.angang.map(t => btn(`暗杠 ${img(t)}`, 'angang', `data-tile="${t}"`)).join('');
        const k = p.kakan .map(t => btn(`加杠 ${img(t)}`, 'kakan',  `data-tile="${t}"`)).join('');
        return a + k + btn('过', 'no');
    }
    return '';
}

function render() {
    if (! game) return;    document.querySelector('#wl-board').innerHTML = `
        <div class="seat top">${seat(2)}</div>
        <div class="seat left">${seat(3)}</div>
        <div class="seat right">${seat(1)}</div>
        <div class="center">
            <div class="joker">${pai(game.shan.indicator)}</div>
            <div class="cap">财神 ${game.shan.joker}</div>
            <div class="wall">${game.jushu_name()}${game.changbang ? ' ' + game.changbang + ' 本场' : ''}</div>
            <div class="wall">牌墙 ${game.shan.paishu} 张</div>
            ${game.nao ? '<div class="nao">闹闹</div>' : ''}
            <div class="turn">${turn_text()}</div>
        </div>
        <div class="seat bottom">${seat(0)}</div>`;
    document.querySelector('#wl-actions').innerHTML = actions();
    tips_panel();
}

/* ---------- 牌效提示 / 训练模式 ---------- */

let tips_on = localStorage.getItem('Wenling.tips') !== '0';
let tips_key = '';
let last_analysis = null;         // { key, analysis } 供训练评分复用

let training       = false;
let current_seed   = null;
let train_decisions = [];         // 本局每次打牌的评价
let train_attempts  = [];         // 同一副牌打过几次

function hand_key(hand) { return hand.pai.slice().sort().join(',') }

function tile_name(p) {
    if (p[0] === 'z') return ['东', '南', '西', '北', '白', '发', '中'][+p[1] - 1];
    if (p[0] === 'f') return Wenling.Pai.FLOWER_NAME[p];
    return p[1] + { m: '万', p: '筒', s: '索' }[p[0]];
}

function tile_list(list, cap = 12) {
    const sorted = list.slice().sort((a, b) => b.left - a.left);
    const shown  = sorted.slice(0, cap);
    let h = '<div class="tile-list">' + shown.map(e =>
        `<span class="item">${pai(e.tile)}<span class="n">${e.left}</span></span>`
    ).join('') + '</div>';
    if (list.length > cap) h += `<div class="tips-sub">…共 ${list.length} 种</div>`;
    return h;
}

function training_html() {
    if (! training) return '';

    const n       = train_decisions.length;
    const optimal = train_decisions.filter(d => d.lost <= 0).length;
    const lost    = train_decisions.reduce((a, d) => a + Math.max(0, d.lost), 0);

    let h = '<div class="tips-head">训练模式</div>';
    h += `<div class="tips-sub">种子 ${current_seed ?? '-'}</div>`;
    h += `<div class="tips-sub">本局 ${n} 次打牌 · 最优 ${optimal} 次 · 累计少算 ${lost} 张</div>`;

    const last = train_decisions.slice(-3).reverse();
    if (last.length) {
        h += '<div class="tips-sub">最近决策</div>';
        h += last.map(d => d.lost > 0
            ? `<div class="cand">打 ${tile_name(d.mine)} → 少算 ${d.lost} 张（最优是 ${tile_name(d.best)}）</div>`
            : `<div class="cand">打 ${tile_name(d.mine)} ✓ 最优</div>`).join('');
    }
    if (train_attempts.length) {
        h += '<div class="tips-sub">同一副牌已打</div>';
        h += train_attempts.slice(-5).reverse().map(a => `<div class="cand">${a}</div>`).join('');
    }
    h += '<div style="margin-top:10px"><button id="wl-train-restart">重开这一局</button></div>';
    return h + '<hr style="border:none;border-top:1px solid #24503f;margin:12px 0">';
}

function tips_html(a, ctx) {
    const hand = game.hands[0];
    const s    = a.shanten;

    let h = '<div class="tips-head">牌效提示</div>';
    h += `<div class="tips-big">${s < 0 ? '已和牌' : s === 0 ? '听牌' : s + ' 向听'}</div>`;

    if (a.is17 && a.best) {
        const b = a.best;
        h += `<div class="tips-sub">推荐打 <b>${tile_name(b.tile)}</b></div>`;
        if (b.shanten === 0 && b.waits.length) {
            h += `<div class="tips-sub">听 ${b.waits.length} 种，共 ${b.ukeire} 张</div>`
               + tile_list(b.waits);
        } else {
            h += `<div class="tips-sub">有效牌 ${b.ukeire} 张（摸到就进张）</div>`
               + tile_list(b.effective);
        }
        const others = a.candidates
            .filter(c => c.tile !== b.tile && c.shanten === b.shanten && c.ukeire > 0)
            .slice(0, 4);
        if (others.length) {
            h += '<div class="tips-sub">同样不亏的选择</div>';
            h += others.map(c =>
                `<div class="cand">打 ${tile_name(c.tile)} → ${c.shanten} 向听，${c.ukeire} 张</div>`
            ).join('');
        }
    }
    else if (s === 0 && a.waits.length) {
        h += `<div class="tips-sub">已听牌：${a.waits.length} 种，共 ${a.waits.reduce((x, w) => x + w.left, 0)} 张</div>`
           + tile_list(a.waits);
    }
    else if (s > 0) {
        const eff = Wenling.ai.effective_tiles(hand, Wenling.ai.visible_counts(ctx));
        const n = eff.reduce((x, w) => x + w.left, 0);
        h += `<div class="tips-sub">当前有效牌 ${n} 张</div>` + tile_list(eff)
           + '<div class="tips-sub">轮到你摸牌后，这里会给打牌建议</div>';
    }
    else {
        h += '<div class="tips-sub">轮到你摸牌后，这里会给打牌建议</div>';
    }
    return h;
}

function highlight_best(tile) {
    const imgs = document.querySelectorAll('#wl-board .seat.bottom .pai.selectable');
    imgs.forEach(img => img.classList.toggle('recommend', img.getAttribute('data-tile') === tile));
}

function tips_panel() {
    const el = document.querySelector('#wl-tips');
    if (! el) return;

    if (! tips_on && ! training) {
        el.innerHTML = '<div class="tips-head">牌效提示</div>'
                     + '<div class="tips-sub">已关闭（勾选上方「牌效提示」开启）</div>';
        return;
    }
    if (! game || ! game.hands.length) return;

    const hand = game.hands[0];
    const key = hand_key(hand) + '|' + game.he.reduce((a, h) => a + h.length, 0)
              + '|' + hand.fulou.length;
    if (key === tips_key) return;
    tips_key = key;

    el.innerHTML = '<div class="tips-head">牌效提示</div><div class="tips-sub">计算中…</div>';
    setTimeout(() => {
        if (key !== tips_key || ! game) return;
        const ctx = { game, player: 0, menfeng: game.menfeng(0), nao: game.nao,
                      joker: game.shan.joker, rule };
        const a = Wenling.ai.analyze(hand, ctx);
        last_analysis = { key: hand_key(hand), analysis: a };
        el.innerHTML = training_html() + tips_html(a, ctx);
        if (a.is17 && a.best) highlight_best(a.best.tile);
    }, 0);
}

/* 训练模式：把这一手和最优解对比 */
function record_training(tile) {
    if (! last_analysis || ! pending || ! pending.hand) return;
    if (last_analysis.key !== hand_key(pending.hand)) return;
    const a = last_analysis.analysis;
    if (! a || ! a.best) return;

    const mine = a.candidates.find(c => c.tile === tile);
    const best = a.best;
    const lost = mine ? Math.max(0, best.ukeire - mine.ukeire) : 0;
    train_decisions.push({ mine: tile, best: best.tile, lost });
}

/* ---------- 等待玩家回答 ---------- */

function ask(question) {
    return new Promise(resolve => {
        pending = Object.assign({}, question, { resolve });
        render();
    });
}

function answer(value) {
    const p = pending;
    pending = null;
    render();
    p.resolve(value);
}

/* ---------- 自动打牌（观战模式） ---------- */

let auto = false;

function random_pick(list) { return list[Math.floor(Math.random() * list.length)] }

function auto_answer() {
    if (! pending) return;
    const p = pending;
    if (p.kind === 'dapai')     return answer(random_pick(p.hand.dapai_list));
    if (p.kind === 'hu')        return answer(true);
    if (p.kind === 'chi')       return answer(null);
    if (p.kind === 'self_gang') return answer(null);
    return answer(false);                       // 碰 / 杠
}

/* ---------- 策略：人类在 P0，其余用牌效 AI ---------- */

/* 机器人出牌节奏（毫秒），让玩家看得清 */
let speed = +(localStorage.getItem('Wenling.speed') ?? 450);
if (! [150, 450, 900].includes(speed)) speed = 450;

const wait = ms => new Promise(r => setTimeout(r, ms));

/* 手里 3 张时可以杠也可以碰，用一个合并提示让玩家自己选 */
let claim_intent = null;

function make_policy() {
    const ai = Wenling.ai.create_policy();

    return {
        dapai(hand, ctx) {
            if (ctx.player === 0 && ! auto) return ask({ kind: 'dapai', hand });

            const tile = ai.dapai(hand, ctx);
            /* 机器人：先算再停顿，让上一张打牌在屏幕上停一会儿 */
            if (ctx.player !== 0 && ! auto && speed > 0) return wait(speed).then(() => tile);
            return tile;
        },
        hu_zimo(hand, ctx) {
            if (ctx.player !== 0 || auto) return true;
            return ask({ kind: 'hu', label: '自摸', tile: hand.pai[hand.pai.length - 1] });
        },
        hu_rong(hand, tile, ctx) {
            if (ctx.player !== 0 || auto) return true;
            return ask({ kind: 'hu', label: `荣和 ${tile}`, tile });
        },
        pon(hand, tile, ctx) {
            if (ctx.player !== 0 || auto) return ai.pon(hand, tile, ctx);
            if (claim_intent && claim_intent.tile === tile) {
                const act = claim_intent.action;
                claim_intent = null;
                return act === 'pon';
            }
            return ask({ kind: 'pon', tile });
        },
        gang(hand, tile, ctx) {
            if (ctx.player !== 0 || auto) return false;
            /* 手里 3 张时杠和碰都成立，让玩家二选一 */
            if (hand.can_pon(tile)) {
                return ask({ kind: 'both', tile }).then(v => {
                    if (v === 'gang') return true;
                    claim_intent = { tile, action: v === 'pon' ? 'pon' : 'pass' };
                    return false;
                });
            }
            return ask({ kind: 'gang', tile });
        },
        chi(hand, options, tile, ctx) {
            if (ctx.player !== 0 || auto) return ai.chi(hand, options, tile, ctx);
            return ask({ kind: 'chi', options, tile });
        },
        self_gang(hand, ctx) {
            if (ctx.player !== 0 || auto) return null;
            const angang = hand.angang_options();
            const kakan  = hand.kakan_options();
            if (! angang.length && ! kakan.length) return null;
            return ask({ kind: 'self_gang', angang, kakan });
        },
    };
}

/* ---------- 事件 ---------- */

document.addEventListener('click', ev => {
    const t = ev.target;

    /* 训练模式：重开这一局 */
    if (t && t.id === 'wl-train-restart') return start(current_seed);

    /* 点牌打牌 */
    if (pending && pending.kind === 'dapai' && t.classList
            && t.classList.contains('selectable')) {
        const tile = t.getAttribute('data-tile');
        if (training) record_training(tile);
        return answer(tile);
    }

    const b = t.closest && t.closest('#wl-actions button');
    if (! b || ! pending) return;

    const act = b.getAttribute('data-act');
    if (act === 'no')  return answer(act === 'no' ? (pending.kind === 'chi' ? null : false) : null);
    if (act === 'yes') return answer(true);
    if (act === 'gang_yes') return answer('gang');
    if (act === 'pon_yes')  return answer('pon');
    if (act === 'chi') return answer(pending.options[+b.getAttribute('data-i')]);
    if (act === 'angang' || act === 'kakan')
        return answer({ type: act, tile: b.getAttribute('data-tile') });
});

/* ---------- 牌谱：存到 localStorage ---------- */

const STORE = 'Wenling.paipu';

function save_record(record) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(STORE) || '[]') } catch (e) { list = [] }
    const id = String(Date.now());
    list.unshift({ id, at: new Date().toISOString(), summary: record.summary, record });
    while (list.length > 30) list.pop();
    try { localStorage.setItem(STORE, JSON.stringify(list)) } catch (e) { /* 容量满了就先不存 */ }
    return id;
}

/* ---------- 结算面板 ---------- */

function show_result(r, record_id) {
    const el = document.querySelector('#wl-result');
    let body = '';

    if (r.type === 'hule') {
        const s = r.score;
        const who = `${NAME[r.menfeng]}家${r.winner === 0 ? '（你）' : ''}`;
        const win_tile = (! r.zimo && r.win_tile)
            ? ` <img class="pai mini" src="img/${r.win_tile}.gif" alt="${r.win_tile}">` : '';
        body += `<h2>${who} ${r.zimo ? '自摸' : '荣和'}${win_tile}</h2>`;
        body += '<table>';
        for (const t of s.tai_list) body += `<tr><td>${t.name}</td><td class="num">${t.tai} 台</td></tr>`;
        body += `<tr><td>台数合计</td><td class="num">${s.tai}</td></tr>`;
        body += `<tr><td>胡头</td><td class="num">${s.hutou}</td></tr>`;
        body += `<tr><td>分数 = ${s.hutou} × 2^${s.tai}</td><td class="num">${s.defen}</td></tr>`;
        if (s.lazi.length)
            body += `<tr><td>腊子</td><td class="num">${s.lazi.join('/')}</td></tr>`;
        body += '</table>';
    }
    else {
        body += '<h2>流局</h2><p>牌墙只剩 8 墩，无人和牌。</p>';
    }

    body += '<table style="margin-top:12px">';
    /* 用和牌当时的庄家算风位，避免显示成轮转后的座位 */
    const zi = r.zhuang ?? game.zhuang;
    const mf = i => (i - zi + 4) % 4;
    r.delta.forEach((d, i) => {
        body += `<tr><td>${NAME[mf(i)]}家（${i === 0 ? '你' : '电脑' + i}）</td>
                     <td class="num">${d >= 0 ? '+' : ''}${d}</td></tr>`;
    });
    body += '</table>';
    body += `<button id="again">再来一局</button>`;
    if (training) body += ` <button id="again-same">重开这一局（同牌）</button>`;
    if (record_id)
        body += ` <a class="replay" href="wenling-replay.html?id=${record_id}">回放这局</a>`;

    el.innerHTML = `<div class="card">${body}</div>`;
    el.classList.remove('hide');

    /* 再来一局：永远是新的牌局 */
    document.querySelector('#again').onclick = () => {
        el.classList.add('hide');
        start();
    };

    /* 训练模式下额外给一个「重打同一副牌」的入口 */
    const again_same = document.querySelector('#again-same');
    if (again_same) again_same.onclick = () => {
        el.classList.add('hide');
        start(current_seed);
    };
}

/* ---------- 启动 ---------- */

document.querySelector('#wl-auto').addEventListener('change', ev => {
    auto = ev.target.checked;
    if (auto) auto_answer();
});

document.querySelector('#wl-tips-on').checked = tips_on;
document.querySelector('#wl-tips-on').addEventListener('change', ev => {
    tips_on = ev.target.checked;
    localStorage.setItem('Wenling.tips', tips_on ? '1' : '0');
    tips_key = '';
    tips_panel();
});

document.querySelector('#wl-training').addEventListener('change', ev => {
    training = ev.target.checked;
    if (training) {
        /* 训练模式必须看得到牌效面板 */
        tips_on = true;
        document.querySelector('#wl-tips-on').checked = true;
        localStorage.setItem('Wenling.tips', '1');
        tips_key = '';
        tips_panel();
    }
    else {
        train_decisions = [];
        train_attempts  = [];
        tips_key = '';
        tips_panel();
    }
});

const speedEl = document.querySelector('#wl-speed');
speedEl.value = String(speed);
speedEl.addEventListener('change', ev => {
    speed = +ev.target.value;
    localStorage.setItem('Wenling.speed', String(speed));
});

document.querySelector('#wl-new').addEventListener('click', () => {
    document.querySelector('#wl-result').classList.add('hide');
    start();                       // 新的一局：换种子
});

async function start(seed) {
    pending = null;

    current_seed    = seed ?? ((Math.random() * 1e9) | 0);
    train_decisions = [];
    tips_key        = '';
    last_analysis   = null;

    const decisions = [];
    const { policy: wrapped, names }
        = Wenling.record.record_policy(make_policy(), decisions);

    game = new Wenling.Game(rule, wrapped, { seed: current_seed });
    game._on_update = () => render();
    game.kaiju();
    render();

    const result = await game.run();
    pending = null;
    render();

    if (training) {
        const sum = result.type === 'hule'
            ? `${result.winner === 0 ? '你胡' : 'P' + result.winner + ' 胡'} ${result.score.defen} 分（${result.score.tai} 台）`
            : '流局';
        train_attempts.push(sum);
        if (train_attempts.length > 8) train_attempts.shift();
        tips_key = '';
        tips_panel();
    }

    const record = Wenling.record.make_record(
        { seed: current_seed, rule, decisions, methods: names, game, result });
    const id = save_record(record);
    show_result(result, id);
}

start();
