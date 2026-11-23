/*!
 *  温岭牌谱统计 —— 从已存的牌谱里跑出长期画像
 *
 *  只做「便宜」的指标：回放本身很快，向听计算每次约 0.3ms；
 *  不做逐手牌效评分（那个贵得多，放在回放页里按需算）。
 */
"use strict";

const Wenling = require('majiang-wenling');

const STORE = 'Wenling.paipu';
const NAME  = ['东', '南', '西', '北'];

function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || '[]') } catch (e) { return [] }
}

function rebuild_hand(snap, rule) {
    const hand = new Wenling.Shoupai(rule, snap.joker);
    for (const p of snap.hands[0].pai)     hand.add(p);
    for (const f of snap.hands[0].flowers) hand.add_flower(f);
    for (const m of snap.hands[0].fulou)
        hand._fulou.push({ kind: m.kind, tile: m.tile, tiles: m.tiles.slice() });
    return hand;
}

/* 单局指标 */
function analyze_game(entry, states, log, result, game) {
    const rule  = entry.record.rule;
    const joker = states[0].joker;

    const row = {
        at:      entry.at,
        jushu:   entry.summary.jushu,
        type:    result.type,
        won:     result.type === 'hule' && result.winner === 0,
        tai:     result.type === 'hule' ? result.score.tai : 0,
        defen:   result.type === 'hule' ? result.score.defen : 0,
        delta:   result.delta[0],
        deal_in: false,
        decisions: 0,
        mistakes:  0,
        lost:      0,
        first_tenpai: null,
    };

    /* 放铳：荣和时，最后一个打牌的玩家就是放铳者 */
    if (result.type === 'hule' && ! result.zimo && result.winner !== 0) {
        for (let i = log.length - 2; i >= 0; i--) {
            if (log[i].action === '打') { row.deal_in = (log[i].player === 0); break }
        }
    }

    /* 逐手：向听失误 + 听牌巡目 */
    for (let i = 1; i < log.length; i++) {
        if (log[i].player !== 0 || log[i].action !== '打') continue;

        const snap = states[i - 1];
        if (! snap) continue;

        const hand  = rebuild_hand(snap, rule);
        const tiles = [...new Set(hand.pai)].filter(p => p !== joker);
        if (! tiles.length) continue;

        let best = 99;
        for (const t of tiles) {
            hand.remove(t);
            best = Math.min(best, Wenling.shanten(hand));
            hand.add(t);
        }

        const actual = log[i].detail;
        if (! hand.pai.includes(actual)) continue;   // 老牌谱可能对不上，跳过而不是崩
        hand.remove(actual);
        const mine = Wenling.shanten(hand);
        hand.add(actual);

        row.decisions++;
        if (mine > best) { row.mistakes++; row.lost += mine - best }
        if (mine === 0 && row.first_tenpai === null) row.first_tenpai = row.decisions;
    }

    return row;
}

/* 汇总 */
function summarize(rows) {
    const ok = rows.filter(r => ! r.error);
    const n  = ok.length;
    const wins   = ok.filter(r => r.won).length;
    const deals  = ok.filter(r => r.deal_in).length;
    const hule   = ok.filter(r => r.type === 'hule');

    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const decisions = ok.reduce((a, r) => a + r.decisions, 0);
    const mistakes  = ok.reduce((a, r) => a + r.mistakes, 0);
    const lost      = ok.reduce((a, r) => a + r.lost, 0);

    const tenpai = ok.filter(r => r.first_tenpai != null).map(r => r.first_tenpai);

    return {
        n,
        win_rate:  n ? wins / n : 0,
        deal_rate: n ? deals / n : 0,
        hule_rate: n ? hule.length / n : 0,
        avg_tai:   avg(hule.filter(r => r.won).map(r => r.tai)),
        avg_defen: avg(hule.filter(r => r.won).map(r => r.defen)),
        total:     ok.reduce((a, r) => a + r.delta, 0),
        avg_delta: avg(ok.map(r => r.delta)),
        decisions, mistakes, lost,
        mistake_rate: decisions ? mistakes / decisions : 0,
        avg_lost:     decisions ? lost / decisions : 0,
        tenpai_rate:  n ? tenpai.length / n : 0,
        avg_tenpai:   avg(tenpai),
    };
}

/* ---------- 渲染 ---------- */

function card(k, v, s) {
    return `<div class="ws-card"><div class="k">${k}</div><div class="v">${v}</div>
            <div class="s">${s || ''}</div></div>`;
}

function render(rows) {
    const s = summarize(rows);
    const pct = x => (x * 100).toFixed(0) + '%';

    document.querySelector('#ws-cards').innerHTML =
        card('对局数', s.n, `平均每局 ${s.avg_delta >= 0 ? '+' : ''}${s.avg_delta.toFixed(1)}`)
      + card('和牌率', pct(s.win_rate), `${Math.round(s.win_rate * s.n)} / ${s.n}`)
      + card('放铳率', pct(s.deal_rate), '荣和时放铳的比例')
      + card('平均台数', s.avg_tai ? s.avg_tai.toFixed(2) : '—', '仅自己胡的局')
      + card('平均打点', s.avg_defen ? Math.round(s.avg_defen) : '—', '仅自己胡的局')
      + card('本次累计', (s.total >= 0 ? '+' : '') + s.total, '四家收支合计')
      + card('听牌率', pct(s.tenpai_rate), s.avg_tenpai ? `平均第 ${s.avg_tenpai.toFixed(1)} 手听牌` : '')
      + card('向听失误率', pct(s.mistake_rate),
             `${s.mistakes} / ${s.decisions} 手，平均多走 ${s.avg_lost.toFixed(2)} 阶`);

    const rows_html = rows.slice().reverse().map(r => {
        if (r.error) {
            const t = r.at ? r.at.slice(5, 16).replace('T', ' ') : '';
            return `<tr><td colspan="6">${t} 解析失败：${r.error}</td></tr>`;
        }
        const t = r.at.slice(5, 16).replace('T', ' ');
        const res = r.type === 'hule'
            ? (r.won ? '<span class="win">你胡</span>' : '别人胡')
            : '流局';
        return `<tr>
            <td>${t}</td>
            <td>${r.jushu}</td>
            <td>${res}</td>
            <td class="num">${r.tai || ''}${r.defen ? ` <span class="s">${r.defen} 分</span>` : ''}</td>
            <td class="num ${r.delta >= 0 ? 'win' : 'lose'}">${r.delta >= 0 ? '+' : ''}${r.delta}</td>
            <td class="num">${r.mistakes ? `<span class="bad">${r.mistakes} 手 / ${r.lost} 阶</span>` : (r.decisions ? '—' : '')}</td>
        </tr>`;
    }).join('');

    document.querySelector('#ws-table').innerHTML = `
        <table>
          <thead><tr><th>时间</th><th>局名</th><th>结果</th><th class="num">台数/打点</th>
                     <th class="num">你的收支</th><th class="num">向听失误</th></tr></thead>
          <tbody>${rows_html}</tbody>
        </table>
        <div id="ws-tips">
          「向听失误」= 你打出的那张让向听数比最优打法更差；只看向听，不算有效牌细节。
          想看每一手的具体得失，去牌谱回放点「定位」。
        </div>`;
}

/* ---------- 主流程 ---------- */

async function main() {
    const records = load();
    const el = document.querySelector('#ws');

    if (! records.length) {
        el.innerHTML = '<div id="ws-empty">还没有牌谱。先去「温岭麻将」打几局。</div>';
        return;
    }

    const progress = document.querySelector('#ws-progress');
    const rows = [];

    for (let i = 0; i < records.length; i++) {
        const entry = records[i];
        progress.textContent = `分析中… ${i + 1} / ${records.length}`;
        try {
            const { states, log, result } = await Wenling.record.replay_game(entry.record);
            rows.push(analyze_game(entry, states, log, result));
        }
        catch (e) {
            rows.push({ at: entry.at, error: e.message });
        }
        await new Promise(r => setTimeout(r, 0));
    }

    progress.textContent = `已分析 ${records.length} 局`;
    render(rows);
}

main();
