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

function seat(l) {
    const h    = game.hands[l];
    const name = NAME[game.menfeng(l)] + (l === game.zhuang ? '（庄）' : '');

    const kuikae = (l === 0) ? h.kuikae : null;
    const hand = l === 0
        ? h.pai.map(p => {
              const cls = (p === kuikae) ? 'disabled'
                        : (pending && pending.kind === 'dapai' ? 'selectable' : '');
              return pai(p, cls);
          }).join('')
        : back(h.shoupaishu);

    const flowers = h.flowers.map(f => Wenling.Pai.FLOWER_NAME[f]).join('');
    const melds   = h.fulou.map(m => m.tiles.map(t => pai(t)).join('')).join(' ');
    const he      = game.he[l].map(p => pai(p)).join('');

    return `<div class="label">${name}${l === 0 ? '' : ' · ' + h.shoupaishu + ' 张'}</div>
            <div class="hand">${hand}</div>
            <div class="flowers">${flowers ? '花：' + flowers : ''}</div>
            <div class="melds">${melds}</div>
            <div class="he">${he}</div>`;
}

function actions() {
    if (! pending) return '';

    const p = pending;
    if (p.kind === 'dapai')    return '<span class="hint">点击你要打出的牌</span>';
    if (p.kind === 'hu')       return btn(`${p.label}`, 'yes') + btn('过', 'no');
    if (p.kind === 'pon')      return btn(`碰 ${p.tile}`, 'yes') + btn('过', 'no');
    if (p.kind === 'gang')     return btn(`杠 ${p.tile}`, 'yes') + btn('过', 'no');

    if (p.kind === 'chi') {
        return p.options.map((o, i) =>
            `<button data-act="chi" data-i="${i}">吃 ${o[0]}${o[1]}${p.tile}</button>`
        ).join('') + btn('过', 'no');
    }

    if (p.kind === 'self_gang') {
        const a = p.angang.map(t => btn(`暗杠 ${t}`, 'angang', `data-tile="${t}"`)).join('');
        const k = p.kakan .map(t => btn(`加杠 ${t}`, 'kakan',  `data-tile="${t}"`)).join('');
        return a + k + btn('过', 'no');
    }
    return '';
}

function render() {
    if (! game) return;
    document.querySelector('#wl-board').innerHTML = `
        <div class="seat top">${seat(2)}</div>
        <div class="seat left">${seat(3)}</div>
        <div class="seat right">${seat(1)}</div>
        <div class="center">
            <div class="joker">${pai(game.shan.indicator)}</div>
            <div class="cap">财神 ${game.shan.joker}</div>
            <div class="wall">${game.jushu_name()}${game.changbang ? ' ' + game.changbang + ' 本场' : ''}</div>
            <div class="wall">牌墙 ${game.shan.paishu} 张</div>
            ${game.nao ? '<div class="nao">闹闹</div>' : ''}
        </div>
        <div class="seat bottom">${seat(0)}</div>`;
    document.querySelector('#wl-actions').innerHTML = actions();
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

function make_policy() {
    const ai = Wenling.ai.create_policy();

    return {
        dapai(hand, ctx) {
            if (ctx.player !== 0 || auto) return ai.dapai(hand, ctx);
            return ask({ kind: 'dapai', hand });
        },
        hu_zimo(hand, ctx) {
            if (ctx.player !== 0 || auto) return true;
            return ask({ kind: 'hu', label: '自摸' });
        },
        hu_rong(hand, tile, ctx) {
            if (ctx.player !== 0 || auto) return true;
            return ask({ kind: 'hu', label: `荣和 ${tile}` });
        },
        pon(hand, tile, ctx) {
            if (ctx.player !== 0 || auto) return ai.pon(hand, tile, ctx);
            return ask({ kind: 'pon', tile });
        },
        gang(hand, tile, ctx) {
            if (ctx.player !== 0 || auto) return false;
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

    /* 点牌打牌 */
    if (pending && pending.kind === 'dapai' && t.classList
            && t.classList.contains('selectable')) {
        const tile = t.getAttribute('data-tile');
        if (pending.hand_pai && ! pending.hand_pai.includes(tile)) return;
        return answer(tile);
    }

    const b = t.closest && t.closest('#actions button');
    if (! b || ! pending) return;

    const act = b.getAttribute('data-act');
    if (act === 'no')  return answer(act === 'no' ? (pending.kind === 'chi' ? null : false) : null);
    if (act === 'yes') return answer(true);
    if (act === 'chi') return answer(pending.options[+b.getAttribute('data-i')]);
    if (act === 'angang' || act === 'kakan')
        return answer({ type: act, tile: b.getAttribute('data-tile') });
});

/* ---------- 结算面板 ---------- */

function show_result(r) {
    const el = document.querySelector('#wl-result');
    let body = '';

    if (r.type === 'hule') {
        const s = r.score;
        body += `<h2>${NAME[r.menfeng]}家${r.winner === 0 ? '（你）' : ` P${r.winner}`}
                 ${r.zimo ? '自摸' : '荣和'}</h2>`;
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
    r.delta.forEach((d, i) => {
        body += `<tr><td>P${i}（${NAME[game.menfeng(i)]}）</td>
                     <td class="num">${d >= 0 ? '+' : ''}${d}</td></tr>`;
    });
    body += '</table>';
    body += '<button id="again">再来一局</button>';

    el.innerHTML = `<div class="card">${body}</div>`;
    el.classList.remove('hide');
    document.querySelector('#again').onclick = () => {
        el.classList.add('hide');
        start();
    };
}

/* ---------- 启动 ---------- */

document.querySelector('#wl-auto').addEventListener('change', ev => {
    auto = ev.target.checked;
    if (auto) auto_answer();
});

document.querySelector('#wl-new').addEventListener('click', () => {
    document.querySelector('#wl-result').classList.add('hide');
    start();
});

async function start() {
    pending = null;
    game = new Wenling.Game(rule, make_policy(),
                            { seed: (Math.random() * 1e9) | 0 });
    game.kaiju();
    render();

    const result = await game.run();
    pending = null;
    render();
    show_result(result);
}

start();
