/* Раздел «Меньше слов, больше дел»: тексты блоков А, В, С, фильтры и списки.
   В блоке А фильтры работают на креативные плитки, в В на список проектов и барабан,
   в С на таблицу интересов. Данные: content/deeds.json, projects.json, creative.json, interests.json. */
(function () {
  'use strict';

  var P = window.Portfolio;
  if (!P || !document.getElementById('deeds')) return;

  var NS = 'http://www.w3.org/2000/svg';
  var LIMIT_A = 8, LIMIT_B = 4;
  var KIND_A = { draw: 'рисунок', result: 'результат', ba: 'до и после' };
  var KIND_B = { site: 'сайт', ml: 'ML', it: 'IT-задача', project: 'проект' };
  var state = { a: 'all', b: 'all', c: 'all', aMore: false, bMore: false };

  function $(id) { return document.getElementById(id); }
  function items(file) { var d = P.data[file]; return (d && d.items) || []; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function icon(id) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'ic');
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    return s;
  }

  function isTodo(v) { return /добавить/i.test(v || ''); }

  // подписи видов для таблицы интересов берём из кнопок-фильтров блока С
  function interestLabels() {
    var map = {};
    Array.prototype.forEach.call(document.querySelectorAll('.fchips[data-group="c"] button'), function (b) {
      map[b.dataset.v] = b.textContent;
    });
    return map;
  }

  function moreButton(btn, count, limit, expanded, openText, closeText) {
    btn.hidden = count <= limit;
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.firstElementChild.textContent = expanded ? closeText : openText;
  }

  function renderA() {
    var all = items('creative').map(function (t, i) { return { t: t, i: i }; });
    var list = all.filter(function (x) { return state.a === 'all' || x.t.kind === state.a; });
    var shown = state.aMore ? list : list.slice(0, LIMIT_A);
    var box = $('tiles');
    box.textContent = '';
    shown.forEach(function (x) {
      var t = x.t, label = KIND_A[t.kind] || t.kind;
      var tile = el('div', 'tile' + (t.kind === 'ba' ? ' ba' : ''));
      tile.style.background = t.kind === 'ba' ? '' : 'var(--t' + (x.i % 4 + 1) + ')';
      var alt = isTodo(t.title) ? label : label + ': ' + t.title;
      if (t.kind === 'ba') {
        var hasImgs = t.before || t.after;
        if (!hasImgs) { tile.setAttribute('role', 'img'); tile.setAttribute('aria-label', alt); }
        [['before', 'l', 'до'], ['after', 'r', 'после']].forEach(function (s) {
          if (t[s[0]]) tile.appendChild(img(t[s[0]], alt + ', ' + s[2], s[1]));
        });
        tile.appendChild(el('span', 'tg', 'до'));
        tile.appendChild(el('span', 'tg r', 'после'));
      } else {
        tile.appendChild(icon(t.kind === 'result' ? 'i-bars' : 'i-img'));
        if (t.image) tile.appendChild(img(t.image, alt, ''));
        else { tile.setAttribute('role', 'img'); tile.setAttribute('aria-label', alt); }
        tile.appendChild(el('span', 'tg', label));
      }
      box.appendChild(tile);
    });
    if (!shown.length) box.appendChild(el('p', 'fallback', 'В этой категории пока ничего нет.'));
    moreButton($('moreA'), list.length, LIMIT_A, state.aMore, 'Показать ещё', 'Свернуть');
  }

  function img(src, alt, cls) {
    var i = el('img', cls);
    i.src = src;
    i.alt = alt;
    i.width = 400;
    i.height = 400;
    i.loading = 'lazy';
    i.decoding = 'async';
    i.addEventListener('error', function () { i.remove(); });
    return i;
  }

  function renderB() {
    var list = items('projects').filter(function (p) { return state.b === 'all' || p.kind === state.b; });
    var shown = state.bMore ? list : list.slice(0, LIMIT_B);
    var box = $('prows');
    box.textContent = '';
    shown.forEach(function (p) {
      var a = el('a', 'prow');
      a.href = p.url || '#projects';
      if (p.url) a.rel = 'noopener';
      a.appendChild(el('b', '', p.title));
      a.appendChild(el('em', '', KIND_B[p.kind] || p.kind));
      var go = el('span', 'go');
      go.appendChild(icon('i-go'));
      a.appendChild(go);
      box.appendChild(a);
    });
    if (!shown.length) box.appendChild(el('p', 'fallback', 'В этой категории пока ничего нет.'));
    moreButton($('moreB'), list.length, LIMIT_B, state.bMore, 'Все проекты', 'Свернуть');
    if (P.drum) P.drum.setItems(list);
  }

  function renderC() {
    var labels = interestLabels();
    var box = $('trows');
    box.textContent = '';
    var n = 0;
    items('interests').forEach(function (r) {
      if (state.c !== 'all' && r.kind !== state.c) return;
      n++;
      var row = el('div', 'tr');
      row.appendChild(el('span', 'kd', labels[r.kind] || r.kind));
      var t = el('span', 'ttext', r.text);
      if (isTodo(r.text)) t.classList.add('todo');
      row.appendChild(t);
      var a = el('a', '', 'Подробнее');
      a.href = r.url || '#order';
      row.appendChild(a);
      box.appendChild(row);
    });
    if (!n) box.appendChild(el('p', 'empty', 'В этой категории пока ничего нет.'));
  }

  Array.prototype.forEach.call(document.querySelectorAll('.fchips'), function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var key = g.dataset.group;
      state[key] = b.dataset.v;
      Array.prototype.forEach.call(g.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      if (key === 'a') renderA();
      if (key === 'b') renderB();
      if (key === 'c') renderC();
    });
  });

  $('moreA').addEventListener('click', function () { state.aMore = !state.aMore; renderA(); });
  $('moreB').addEventListener('click', function () { state.bMore = !state.bMore; renderB(); });

  P.on('deeds', function () { if (!P.editing) P.fill('deeds'); });
  P.on('interests', function () { if (!P.editing) P.fill('interests'); renderC(); });
  P.on('creative', renderA);
  P.on('projects', renderB);
})();
