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
    const hand = h.pai.map(p => pai(p)).join('');
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
    document.querySelector('#wr-log').innerHTML =
        `<span class="tag">${cursor + 1} / ${states.length}</span>${who}${rec.action} ${rec.detail}`;

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
    }).catch(e => {
        document.querySelector('#wr').innerHTML =
            `<div id="wr-empty">回放失败：${e.message}</div>`;
    });
}
