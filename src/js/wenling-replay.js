/*!
 *  温岭牌谱回放 —— 逐手前进/后退
 *
 *  牌谱只存「种子 + 决策」，这里用引擎重跑一遍，抓下每一步的盘面状态。
 *  回放是明牌：四家手牌全部可见，用来复盘。
 */
"use strict";

const Wenling = require('majiang-wenling');

const NAME = ['东', '南', '西', '北'];
const STORE = 'Wenling.paipu';

let states = [];
let logs   = [];
let cursor = 0;

/* ---------- 渲染 ---------- */

function pai(p, cls = '') {
    return `<img class="pai ${cls}" src="img/${p}.gif" alt="${p}">`;
}

function seat_html(state, l) {
    const h = state.hands[l];
    const name = NAME[state.menfeng[l]] + (state.zhuang === l ? '（庄）' : '') + ` · ${h.pai.length} 张`;
    const tiles = h.pai.slice().sort((a, b) =>
        Wenling.Pai.sort_key(a) - Wenling.Pai.sort_key(b));
    const hand = tiles.map(p => pai(p)).join('');
    const flowers = h.flowers.map(f => Wenling.Pai.FLOWER_NAME[f]).join('');
    const melds = h.fulou.map(m => m.tiles.map(t => pai(t)).join('')).join(' ');
    const he = state.he[l].map(p => pai(p)).join('');
    return `<div class="label">${name}</div>
            <div class="hand">${hand}</div>
            <div class="flowers">${flowers ? '花：' + flowers : ''}</div>
            <div class="melds">${melds}</div>
            <div class="he">${he}</div>`;
}

function render() {
    const s = states[cursor];
    document.querySelector('#wr-board').innerHTML = `
        <div class="seat top">${seat_html(s, 2)}</div>
        <div class="seat left">${seat_html(s, 3)}</div>
        <div class="seat right">${seat_html(s, 1)}</div>
        <div class="center">
            ${pai(s.indicator)}
            <div class="cap">财神 ${s.joker}</div>
            <div class="wall">${s.jushu}${s.changbang ? ' ' + s.changbang + ' 本场' : ''}</div>
            <div class="wall">牌墙 ${s.paishu} 张</div>
            ${s.nao ? '<div class="nao">闹闹</div>' : ''}
        </div>
        <div class="seat bottom">${seat_html(s, 0)}</div>`;

    const rec = logs[cursor];
    const who = rec.player == null ? '' : `P${rec.player} `;
    const g   = grades[cursor];
    let badge = '';
    if (g && (g.gap > 0 || g.lost > 0)) {
        badge = g.gap > 0
            ? `<span class="bad">⚠ 多 1 向听（最优是 ${tile_name(g.best)}）</span>`
            : `<span class="bad">⚠ 少算 ${g.lost} 张（最优是 ${tile_name(g.best)}）</span>`;
    }
    else if (g) {
        badge = '<span class="ok">✓ 最优</span>';
    }
    document.querySelector('#wr-log').innerHTML =
        `<span class="tag">${cursor + 1} / ${states.length}</span>${who}${rec.action} ${rec.detail}${badge}`;

    document.querySelector('#wr-counter').textContent =
        `${cursor + 1} / ${states.length} 手`;

    document.querySelector('#wr-first').disabled = cursor === 0;
    document.querySelector('#wr-prev').disabled  = cursor === 0;
    document.querySelector('#wr-next').disabled  = cursor >= states.length - 1;
    document.querySelector('#wr-last').disabled  = cursor >= states.length - 1;
}

function go(i) {
    cursor = Math.max(0, Math.min(states.length - 1, i));
    render();
}

/* ---------- 牌效评分（复盘用） ---------- */

let grades = [];                 // log 下标 → 评分
let grade_state = { done: 0, total: 0 };

function tile_name(p) {
    if (p[0] === 'z') return ['东', '南', '西', '北', '白', '发', '中'][+p[1] - 1];
    if (p[0] === 'f') return Wenling.Pai.FLOWER_NAME[p];
    return p[1] + { m: '万', p: '筒', s: '索' }[p[0]];
}

/* 用回放快照还原出「打牌前」的手牌 */
function rebuild_hand(snap, rule) {
    const hand = new Wenling.Shoupai(rule, snap.joker);
    for (const p of snap.hands[0].pai)     hand.add(p);
    for (const f of snap.hands[0].flowers) hand.add_flower(f);
    for (const p of (snap.hands[0].baiban || [])) hand.add_baiban(p);
    for (const m of snap.hands[0].fulou)
        hand._fulou.push({ kind: m.kind, tile: m.tile, tiles: m.tiles.slice() });
    return hand;
}

function grade_one(i, rule) {
    const snap = states[i - 1];
    if (! snap) return null;

    const hand = rebuild_hand(snap, rule);
    const ctx  = {
        game:    { he: snap.he, hands: snap.hands.map(h => ({ fulou: h.fulou })) },
        menfeng: snap.menfeng[0],
        nao:     snap.nao,
        joker:   snap.joker,
        rule,
    };
    const a = Wenling.ai.analyze(hand, ctx);
    if (! a.is17 || ! a.best) return null;

    const tile = logs[i].detail;
    const mine = a.candidates.find(c => c.tile === tile);
    if (! mine) return null;

    const gap = mine.shanten - a.best.shanten;
    return {
        mine: tile, best: a.best.tile, gap,
        lost: gap > 0 ? 0 : Math.max(0, a.best.ukeire - mine.ukeire),
        best_ukeire: a.best.ukeire, mine_ukeire: mine.ukeire,
    };
}

async function grade_all(rule) {
    const idx = [];
    for (let i = 1; i < logs.length; i++)
        if (logs[i].player === 0 && logs[i].action === '打') idx.push(i);

    grades = [];
    grade_state = { done: 0, total: idx.length };
    render_summary();

    for (let k = 0; k < idx.length; k++) {
        grades[idx[k]] = grade_one(idx[k], rule);
        grade_state.done = k + 1;
        if (k % 2 === 1) {
            render_summary();
            await new Promise(r => setTimeout(r, 0));   // 让界面喘口气
        }
    }
    grade_state.done = idx.length;
    render_summary();
    render();
}

function render_summary() {
    const el = document.querySelector('#wr-summary');
    if (! el) return;

    if (! grade_state.total) { el.innerHTML = ''; return }

    if (grade_state.done < grade_state.total) {
        el.innerHTML = `牌效评分计算中… ${grade_state.done} / ${grade_state.total}`;
        return;
    }

    const items = Object.entries(grades).filter(([, g]) => g);
    if (! items.length) { el.innerHTML = '这局没有你的打牌记录。'; return }

    let opt = 0, lost = 0, gap = 0;
    const bad = [];
    for (const [i, g] of items) {
        if (g.gap === 0 && g.lost === 0) opt++;
        lost += g.lost;
        gap  += g.gap;
        if (g.gap > 0 || g.lost > 0) bad.push({ i: +i, g });
    }
    bad.sort((a, b) => (b.g.gap - a.g.gap) || (b.g.lost - a.g.lost));

    let h = `你的打牌评分：共 <b>${items.length}</b> 手，最优 <b>${opt}</b> 手，`
          + `累计少算 <b>${lost}</b> 张`;
    if (gap) h += `，多走 <b>${gap}</b> 个向听`;

    if (bad.length) {
        h += '<div style="margin-top:6px">最贵的几处：</div>';
        h += bad.slice(0, 3).map(b =>
            `<div>第 ${b.i + 1} 步 打 ${tile_name(b.g.mine)} → `
            + (b.g.gap > 0 ? '多走 1 个向听' : `少算 ${b.g.lost} 张`)
            + `（最优 ${tile_name(b.g.best)}） <span class="jump" data-step="${b.i}">定位</span></div>`
        ).join('');
    }
    else {
        h += '<div style="margin-top:6px">全部最优，打得干净。</div>';
    }
    el.innerHTML = h;
}

document.addEventListener('click', ev => {
    const t = ev.target;
    if (t && t.classList && t.classList.contains('jump')) {
        go(+t.getAttribute('data-step'));
    }
});

/* ---------- 载入 ---------- */

function label(e) {
    const s = e.summary;
    const t = e.at.slice(5, 16).replace('T', ' ');
    const r = s.type === 'hule'
        ? `P${s.winner} ${s.defen} 分（${s.tai} 台）`
        : '流局';
    return `${t}  ${s.jushu}  ${r}`;
}

let list = [];
try { list = JSON.parse(localStorage.getItem(STORE) || '[]') } catch (e) { list = [] }

if (! list.length) {
    document.querySelector('#wr').innerHTML =
        '<div id="wr-empty">还没有牌谱。到「温岭麻将」打一局，结算面板里点「回放这局」。</div>';
}
else {
    const id = new URLSearchParams(location.search).get('id');
    const sel = document.querySelector('#wr-select');
    sel.innerHTML = list.map(e =>
        `<option value="${e.id}" ${e.id === id ? 'selected' : ''}>${label(e)}</option>`
    ).join('');
    sel.onchange = () => { location.href = `wenling-replay.html?id=${sel.value}` };

    const entry = list.find(e => e.id === id) || list[0];

    Wenling.record.replay_game(entry.record).then(({ states: st, log, result }) => {
        states = st;
        logs   = log;
        cursor = 0;
        render();

        document.querySelector('#wr-first').onclick = () => go(0);
        document.querySelector('#wr-prev').onclick  = () => go(cursor - 1);
        document.querySelector('#wr-next').onclick  = () => go(cursor + 1);
        document.querySelector('#wr-last').onclick  = () => go(states.length - 1);

        grade_all(entry.record.rule);
    }).catch(e => {
        document.querySelector('#wr').innerHTML =
            `<div id="wr-empty">回放失败：${e.message}</div>`;
    });
}
