/*
 *  Majiang.Rulesets —— 规则集注册表
 *
 *  一套规则 = 引擎 + 视图 + 入口页。主工程只负责「选哪套、跳哪页」，
 *  不关心规则细节。以后加国标/川麻，只要在这里登记一条。
 */
"use strict";

const list = new Map();

const STORAGE_KEY = 'Majiang.ruleset';

function register(id, def) {
    list.set(id, Object.assign({ id, players: 4 }, def));
    return list.get(id);
}

function all()  { return [...list.values()] }
function get(id) { return list.get(id) }

/* 当前选择（localStorage），没选过就返回第一套 */
function current() {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id && list.has(id)) return list.get(id);
    return all()[0];
}

function select(id) {
    if (! list.has(id)) throw new Error(`未知规则集: ${id}`);
    localStorage.setItem(STORAGE_KEY, id);
    return list.get(id);
}

/* ---------- 已登记的规则集 ---------- */

register('riichi', {
    name:  '日本立直麻将',
    short: '日麻',
    desc:  '标准日麻：立直、宝牌、符番计算，136 张，13 张手牌',
    url:   'index.html',
    tags:  ['立直', '宝牌', '符番'],
});

register('wenling', {
    name:  '温岭麻将',
    short: '温岭',
    desc:  '浙江温岭打法：144 张含花牌、财神万能牌、胡头 × 2^台数、腊子封顶',
    url:   'wenling.html',
    tags:  ['财神', '花牌', '胡头台数', '腊子'],
});

module.exports = { register, all, get, current, select, STORAGE_KEY };
