/*!
 *  选择规则集 —— 开桌入口
 */
"use strict";

const Rulesets = require('./rulesets');

const cur = Rulesets.current();

function render() {
    document.querySelector('#rs-list').innerHTML = Rulesets.all().map(r => `
        <div class="rs-card ${r.id === cur.id ? 'current' : ''}" data-id="${r.id}">
            <div class="rs-head">
                <span class="rs-name">${r.name}</span>
                ${r.id === cur.id ? '<span class="rs-badge">上次选择</span>' : ''}
            </div>
            <p class="rs-desc">${r.desc}</p>
            <div class="rs-tags">${r.tags.map(t => `<span>${t}</span>`).join('')}</div>
            <button data-id="${r.id}">开始对局</button>
        </div>`).join('');
}

document.addEventListener('click', ev => {
    const el = ev.target.closest ? ev.target.closest('[data-id]') : null;
    if (! el) return;
    const id = el.getAttribute('data-id');
    if (! id) return;
    Rulesets.select(id);
    location.href = Rulesets.get(id).url;
});

render();
