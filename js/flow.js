/* Раздел «Как это происходит»: змейка рисуется при прокрутке, на конце зелёная точка,
   карточки этапов появляются по очереди. Данные: content/stages.json.
   Без JS и при prefers-reduced-motion все карточки видны сразу (класс .js ставится только после сборки). */
(function () {
  'use strict';

  var P = window.Portfolio;
  var flow = document.getElementById('flowbox');
  if (!P || !flow) return;

  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var svg = flow.querySelector('svg');
  var live = svg.querySelector('.live');
  var track = svg.querySelector('.track');
  var head = svg.querySelector('.head');
  var grad = svg.querySelector('#flowg');
  var STEP = 4, LAMBDA = 0.35;
  var cards = [], cy = [], vs = [], L = 0, H = 0, ticking = false, rt = 0;

  function renderSteps(items) {
    Array.prototype.forEach.call(flow.querySelectorAll('.step'), function (s) { s.remove(); });
    items.forEach(function (it, i) {
      var step = document.createElement('div');
      step.className = 'step';
      var card = document.createElement('article');
      card.className = 'fcard';
      var top = document.createElement('div');
      top.className = 'top';
      var num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;
      var h = document.createElement('h3');
      h.textContent = it.title;
      top.appendChild(num);
      top.appendChild(h);
      var p = document.createElement('p');
      p.textContent = it.text;
      if (/добавить/i.test(it.text)) p.classList.add('todo');
      card.appendChild(top);
      card.appendChild(p);
      step.appendChild(card);
      flow.appendChild(step);
    });
  }

  function build() {
    cards = Array.prototype.slice.call(flow.querySelectorAll('.fcard'));
    if (!cards.length) return;
    var W = flow.clientWidth;
    H = flow.offsetHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    grad.setAttribute('y2', H);
    var fr = flow.getBoundingClientRect();
    var rects = cards.map(function (c) { return c.getBoundingClientRect(); });
    cy = rects.map(function (r) { return r.top - fr.top + r.height / 2; });
    var mobile = W < 720, n = cards.length;
    var xL = mobile ? 20 : W * 0.36, xR = mobile ? 46 : W * 0.64;
    var y0 = cy[0] - 130, k0 = 0.55 * 130;
    var d = 'M ' + xL + ' ' + y0 + ' C ' + (xL - k0) + ' ' + y0 + ' ' + (xL - k0) + ' ' + cy[0] + ' ' + xL + ' ' + cy[0];
    for (var i = 0; i < n; i++) {
      var dir = (i % 2 === 0) ? 1 : -1, endx = dir > 0 ? xR : xL;
      if (i === n - 1 && !mobile) {
        endx = dir > 0 ? rects[i].right - fr.left - 16 : rects[i].left - fr.left + 16;
      }
      d += ' L ' + endx + ' ' + cy[i];
      if (i < n - 1) {
        var k = 0.55 * (cy[i + 1] - cy[i]);
        d += ' C ' + (endx + dir * k) + ' ' + cy[i] + ' ' + (endx + dir * k) + ' ' + cy[i + 1] + ' ' + endx + ' ' + cy[i + 1];
      }
    }
    live.setAttribute('d', d);
    track.setAttribute('d', d);
    L = live.getTotalLength();
    live.style.strokeDasharray = L;
    // «время» вдоль змейки: прокрутка монотонна, а путь местами идёт вверх, поэтому y + LAMBDA * длина
    vs = [];
    for (var s = 0; s <= L + STEP; s += STEP) {
      var sc = Math.min(s, L), p = live.getPointAtLength(sc);
      vs.push(p.y + LAMBDA * sc);
    }
    update();
    // карточки прячутся (для анимации появления) только когда всё собрано и состояние `on` уже расставлено
    document.documentElement.classList.add('js');
  }

  function update() {
    ticking = false;
    if (!L) return;
    var vh = window.innerHeight, fr = flow.getBoundingClientRect();
    var reduce = mq.matches;
    var t = reduce ? 1 : Math.max(0, Math.min(1, (vh * 0.6 - fr.top) / H));
    var v0 = vs[0], v1 = vs[vs.length - 1], tv = v0 + t * (v1 - v0);
    var lo = 0, hi = vs.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (vs[mid] < tv) lo = mid + 1; else hi = mid;
    }
    var s = Math.min(L, lo * STEP);
    live.style.strokeDashoffset = L - s;
    var pt = live.getPointAtLength(s);
    head.setAttribute('cx', pt.x);
    head.setAttribute('cy', pt.y);
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('on', reduce || pt.y >= cy[i] - 170);
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  function rebuild() {
    clearTimeout(rt);
    rt = setTimeout(build, 120);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('load', build);
  if (window.ResizeObserver) new ResizeObserver(rebuild).observe(flow);
  else window.addEventListener('resize', rebuild);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  if (mq.addEventListener) mq.addEventListener('change', update);

  P.on('stages', function (d) {
    if (!P.editing) P.fill('stages');
    if (d.items && d.items.length) renderSteps(d.items);
    build();
  });

  build();
})();
