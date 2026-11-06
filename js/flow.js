/* Раздел «Как это происходит»: кисть ведёт краску по пути, этапы зажигаются по мере её прохода.
   Данные: content/stages.json.

   Как это устроено:
   - геометрия (путь, выборка точек, длины до узлов) считается один раз в build() и при resize;
   - прокрутка задаёт только ЦЕЛЬ (длину пути), а кисть догоняет её плавно в цикле rAF,
     цикл крутится, только пока есть что догонять;
   - при prefers-reduced-motion кисти и анимаций нет: след готов, все этапы зажжены;
   - без JS (или пока не собрано) карточки видны сразу, а линию заменяет полоса из CSS (.flow:not(.ready)). */
(function () {
  'use strict';

  var P = window.Portfolio;
  var flow = document.getElementById('flowbox');
  if (!P || !flow) return;

  var NS = 'http://www.w3.org/2000/svg';
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var trail = flow.querySelector('svg.trail');
  var over = flow.querySelector('svg.over');
  var track = trail.querySelector('.track');
  var reveal = trail.querySelector('.reveal');
  var ink = trail.querySelector('.ink');
  var rough = trail.querySelector('.rough');
  var wets = Array.prototype.slice.call(trail.querySelectorAll('.wet'));
  var brush = trail.querySelector('.brush');
  var pose = trail.querySelector('.bpose');
  var bscale = trail.querySelector('.bscale');
  var btip = trail.querySelector('.btip');
  var grad = trail.querySelector('#flowg');

  var DS = 3;               // шаг выборки точек пути, px
  var LAMBDA = 0.35;        // «время» вдоль пути: y + LAMBDA * длина (прокрутка монотонна, путь местами идёт вверх)
  var WET = 60;             // длина «влажного» участка за кистью
  var APPEAR = 70, HIDE = 110;   // карточка появляется, когда до узла осталось APPEAR px пути
  var HYST = 14;                 // запас при обратной прокрутке, чтобы узлы не мигали

  var STOPS = [[0, [47, 155, 219]], [0.5, [242, 169, 59]], [1, [224, 80, 143]]];

  var cards = [], steps = [];
  var xs, ys, cosA, vs;           // выборка пути: координаты, косинус направления, «время»
  var sn = [], nodes = [], nodePos = [], lit = [], shown = [];
  var L = 0, H = 0, W = 0, narrow = false;
  var cur = 0, tgt = 0, wob = 0, wetK = 1, cosS = 1, lastTip = '';
  var running = false, raf = 0, last = 0, scrollQueued = false;
  var flickAt = -1, finalDone = false, rt = 0;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function colorAt(t) {
    t = clamp(t, 0, 1);
    var i = t < 0.5 ? 0 : 1, a = STOPS[i], b = STOPS[i + 1];
    var k = (t - a[0]) / (b[0] - a[0]);
    return 'rgb(' + [0, 1, 2].map(function (j) { return Math.round(a[1][j] + (b[1][j] - a[1][j]) * k); }).join(',') + ')';
  }

  function svgEl(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* ---------- разметка этапов ---------- */
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
      flow.insertBefore(step, over);
    });
  }

  /* ---------- геометрия: считается один раз при сборке ---------- */
  function build() {
    steps = Array.prototype.slice.call(flow.querySelectorAll('.step'));
    cards = steps.map(function (s) { return s.querySelector('.fcard'); });
    var n = cards.length;
    if (!n) return;

    var frac = L ? cur / L : 0;      // доля пути, чтобы при resize кисть не прыгала
    W = flow.clientWidth;
    H = flow.offsetHeight;
    narrow = W < 720;

    // положения карточек берём из вёрстки (offset*), а не из getBoundingClientRect:
    // у скрытых карточек есть transform, и он сдвинул бы путь
    var box = cards.map(function (c, i) {
      var st = steps[i];
      return { l: st.offsetLeft + c.offsetLeft, r: st.offsetLeft + c.offsetLeft + c.offsetWidth,
               cy: st.offsetTop + c.offsetTop + c.offsetHeight / 2 };
    });
    var xL = narrow ? 20 : W * 0.36, xR = narrow ? 46 : W * 0.64;
    var y0 = box[0].cy - 130, k0 = 0.55 * 130;
    var d = 'M ' + xL + ' ' + y0 + ' C ' + (xL - k0) + ' ' + y0 + ' ' + (xL - k0) + ' ' + box[0].cy + ' ' + xL + ' ' + box[0].cy;
    var nodeXY = [];
    for (var i = 0; i < n; i++) {
      var dir = (i % 2 === 0) ? 1 : -1, endx = dir > 0 ? xR : xL;
      // узел стоит там, где линия входит под карточку (на узком экране в конце горизонтального отрезка)
      var nx = narrow ? endx : (dir > 0 ? box[i].l : box[i].r);
      if (i === n - 1 && !narrow) endx = nx + (dir > 0 ? 4 : -4);
      nodeXY.push([nx, box[i].cy]);
      d += ' L ' + endx + ' ' + box[i].cy;
      if (i < n - 1) {
        var k = 0.55 * (box[i + 1].cy - box[i].cy);
        d += ' C ' + (endx + dir * k) + ' ' + box[i].cy + ' ' + (endx + dir * k) + ' ' + box[i + 1].cy + ' ' + endx + ' ' + box[i + 1].cy;
      }
    }

    trail.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    over.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    grad.setAttribute('y2', H);
    track.setAttribute('d', d);
    reveal.setAttribute('d', d);
    L = track.getTotalLength();

    // выборка точек пути: дальше кадр не трогает DOM-геометрию
    var m = Math.ceil(L / DS) + 1;
    xs = new Float32Array(m + 1);
    ys = new Float32Array(m + 1);
    for (var j = 0; j <= m; j++) {
      var pt = track.getPointAtLength(Math.min(j * DS, L));
      xs[j] = pt.x;
      ys[j] = pt.y;
    }
    cosA = new Float32Array(m + 1);
    vs = new Float32Array(m + 1);
    var back = 4, fwd = 4;   // смотрим на точки чуть позади и чуть впереди (±12px)
    for (j = 0; j <= m; j++) {
      var a = Math.max(0, j - back), b = Math.min(m, j + fwd);
      var dx = xs[b] - xs[a], dy = ys[b] - ys[a], len = Math.sqrt(dx * dx + dy * dy) || 1;
      cosA[j] = dx / len;
      vs[j] = ys[j] + LAMBDA * j * DS;
    }

    // положение каждого узла на пути (длина), ищем один раз
    sn = nodeXY.map(function (q) {
      var best = 0, bd = Infinity;
      for (var t = 0; t <= m; t++) {
        var ddx = xs[t] - q[0], ddy = ys[t] - q[1], dd = ddx * ddx + ddy * ddy;
        if (dd < bd) { bd = dd; best = t; }
      }
      return Math.min(best * DS, L);
    });

    buildInk(m);
    buildNodes(nodeXY);

    // на узких экранах неровные края (SVG-фильтр) отключаем: на телефонах он тормозит
    if (narrow) rough.removeAttribute('filter'); else rough.setAttribute('filter', 'url(#flowrough)');
    [trail.querySelector('#flowrough'), trail.querySelector('#flowmask')].forEach(function (e) {
      ['width', 'height'].forEach(function (a) { e.setAttribute(a, a === 'width' ? W + 120 : H + 120); });
    });
    reveal.style.strokeDasharray = L;
    bscale.setAttribute('transform', 'scale(' + (narrow ? 0.78 : 1) + ')');

    flow.classList.add('ready');
    cur = frac * L;
    setStatesSilently();
    if (mq.matches) { showAll(); return; }
    brush.style.display = '';
    wets.forEach(function (w) { w.style.display = ''; });
    calcTarget();
    draw(performance.now());
    kick();
  }

  // Мазок: контур переменной толщины вдоль пути (края слегка гуляют), чтобы линия не выглядела инженерной
  function buildInk(m) {
    var left = [], right = [];
    for (var j = 0; j <= m; j++) {
      var a = Math.max(0, j - 1), b = Math.min(m, j + 1);
      var tx = xs[b] - xs[a], ty = ys[b] - ys[a], len = Math.sqrt(tx * tx + ty * ty) || 1;
      tx /= len; ty /= len;
      var s = j * DS;
      var w = (narrow ? 15 : 20) + 3.2 * Math.sin(s / 46) + 2 * Math.sin(s / 17 + 1.3) + 1.4 * Math.sin(s / 131 + 2);
      if (s < 30) w *= 0.55 + 0.45 * s / 30;
      var hw = w / 2, nx = -ty, ny = tx;
      left.push([xs[j] + nx * hw, ys[j] + ny * hw]);
      right.push([xs[j] - nx * hw, ys[j] - ny * hw]);
    }
    function cap(j, sign) {   // полукруг на конце
      var a = Math.max(0, j - 1), b = Math.min(m, j + 1);
      var tx = xs[b] - xs[a], ty = ys[b] - ys[a], len = Math.sqrt(tx * tx + ty * ty) || 1;
      tx = tx / len * sign; ty = ty / len * sign;
      var hw = Math.hypot(left[j][0] - xs[j], left[j][1] - ys[j]), nx = -ty, ny = tx, pts = [];
      for (var q = 1; q < 8; q++) {
        var th = Math.PI * q / 8;
        pts.push([xs[j] + nx * hw * Math.cos(th) + tx * hw * Math.sin(th), ys[j] + ny * hw * Math.cos(th) + ty * hw * Math.sin(th)]);
      }
      return pts;
    }
    var pts = left.concat(cap(m, 1), right.slice().reverse(), cap(0, -1));
    ink.setAttribute('d', 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z');
  }

  function buildNodes(nodeXY) {
    over.textContent = '';
    nodes = [];
    nodePos = nodeXY;
    steps.forEach(function (st, i) {
      var g = svgEl('g', { 'class': 'node', transform: 'translate(' + nodeXY[i][0].toFixed(1) + ' ' + nodeXY[i][1].toFixed(1) + ')' });
      g.style.setProperty('--c', getComputedStyle(st).getPropertyValue('--c'));
      g.appendChild(svgEl('circle', { 'class': 'core', r: 12 }));
      over.appendChild(g);
      nodes.push(g);
    });
  }

  /* ---------- цель по прокрутке ---------- */
  function calcTarget() {
    if (!L) return;
    var vh = window.innerHeight, top = flow.getBoundingClientRect().top;
    var t = clamp((vh * 0.6 - top) / H, 0, 1);
    var v0 = vs[0], v1 = vs[vs.length - 1], tv = v0 + t * (v1 - v0);
    var lo = 0, hi = vs.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (vs[mid] < tv) lo = mid + 1; else hi = mid;
    }
    var f = 0;
    if (lo > 0 && vs[lo] > vs[lo - 1]) f = (tv - vs[lo - 1]) / (vs[lo] - vs[lo - 1]);
    tgt = clamp(((lo > 0 ? lo - 1 : 0) + f) * DS, 0, L);
  }

  /* ---------- состояния узлов и карточек ---------- */
  function setLit(i, on) {
    lit[i] = on;
    nodes[i].classList.toggle('lit', on);
  }
  function setShown(i, on) {
    shown[i] = on;
    cards[i].classList.toggle('on', on);
  }

  function setStatesSilently() {
    sn.forEach(function (s, i) {
      setLit(i, cur >= s - 0.5);
      setShown(i, cur >= s - APPEAR);
    });
    finalDone = cur >= L - 1;
  }

  function showAll() {
    reveal.style.strokeDashoffset = 0;
    brush.style.display = 'none';
    wets.forEach(function (w) { w.style.display = 'none'; });
    sn.forEach(function (s, i) { setLit(i, true); setShown(i, true); });
  }

  function stepStates(delayBase) {
    var fired = 0;
    for (var i = 0; i < sn.length; i++) {
      if (!lit[i] && cur >= sn[i]) {
        setLit(i, true);
        burst(i, i === sn.length - 1, (fired++) * 90);
      } else if (lit[i] && cur < sn[i] - HYST) {
        setLit(i, false);
      }
      if (!shown[i] && cur >= sn[i] - APPEAR) setShown(i, true);
      else if (shown[i] && cur < sn[i] - HIDE) setShown(i, false);
    }
  }

  // Вспышка: пульс-кольцо и 5-6 брызг краски. Элементы живут ~0,7 с и удаляются.
  function burst(i, isLast, delay) {
    if (mq.matches || !nodes[i] || !nodes[i].animate) return;
    var g = nodes[i];
    var ring = svgEl('circle', { r: 13, fill: 'none', 'stroke-width': 3 });
    ring.style.stroke = 'var(--c)';
    ring.style.transformBox = 'fill-box';
    ring.style.transformOrigin = 'center';
    g.appendChild(ring);
    done(ring.animate([{ transform: 'scale(.7)', opacity: 0.9 }, { transform: 'scale(' + (isLast ? 3.6 : 2.6) + ')', opacity: 0 }],
      { duration: isLast ? 900 : 650, delay: delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }), ring);
    var count = 5 + Math.round(Math.random());
    for (var j = 0; j < count; j++) {
      var ang = (j / count) * Math.PI * 2 + Math.random() * 0.7;
      var dist = 30 + Math.random() * 26, r = 2.2 + Math.random() * 2.6;
      var sp = svgEl('circle', { r: r });
      sp.style.fill = 'var(--c)';
      sp.style.opacity = 0;
      g.appendChild(sp);
      done(sp.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: 'translate(' + (Math.cos(ang) * dist).toFixed(1) + 'px,' + (Math.sin(ang) * dist).toFixed(1) + 'px) scale(.2)', opacity: 0 }
      ], { duration: 600 + Math.random() * 200, delay: delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }), sp);
    }
  }
  function done(anim, el) { anim.onfinish = function () { el.remove(); }; }

  /* ---------- кадр ---------- */
  function sample(s) {
    var f = s / DS, i = Math.min(Math.floor(f), xs.length - 2), k = f - i;
    return { x: xs[i] + (xs[i + 1] - xs[i]) * k, y: ys[i] + (ys[i + 1] - ys[i]) * k, c: cosA[i] + (cosA[i + 1] - cosA[i]) * k };
  }

  function flickRot(ts) {
    if (flickAt < 0) return 0;
    var e = ts - flickAt;
    if (e > 700) { flickAt = -1; return 0; }
    return 24 * Math.sin(e / 700 * Math.PI * 4) * (1 - e / 700);
  }

  function draw(ts) {
    var p = sample(cur);
    reveal.style.strokeDashoffset = L - cur;
    // направление движения: ручка всегда смотрит вверх и лишь отклоняется назад по ходу (-135°…-45°),
    // поэтому кисть не переворачивается; косинус сглажен в кадре
    var rot = -90 - 45 * cosS + Math.sin(ts * 0.02) * 3.5 * wob + flickRot(ts);
    pose.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')');
    var col = colorAt(p.y / H);
    if (col !== lastTip) { btip.setAttribute('fill', col); lastTip = col; }
    // влажный участок: три куска за кистью, ближний самый светлый, со временем подсыхает
    for (var j = 0; j < 3; j++) {
      var a = Math.max(0, cur - WET + j * (WET / 3)), b = Math.max(0, cur - (2 - j) * (WET / 3));
      var w = wets[j];
      w.style.strokeDasharray = Math.max(0, b - a).toFixed(1) + ' ' + (L * 2);
      w.style.strokeDashoffset = (-a).toFixed(1);
      w.style.opacity = ([0.14, 0.3, 0.55][j] * wetK).toFixed(3);
    }
  }

  function frame(ts) {
    raf = 0;
    var f = Math.min(50, ts - last) / 16.667;   // кадры; тихая вкладка не даёт скачка
    last = ts;
    var prev = cur, diff = tgt - cur;
    // экспоненциальное сглаживание: около 0,1 за кадр
    cur = Math.abs(diff) < 0.3 ? tgt : cur + diff * (1 - Math.pow(0.9, f));
    var spd = Math.abs(cur - prev) / Math.max(f, 0.01);
    wob += (Math.min(1, spd / 1.5) - wob) * Math.min(1, 0.12 * f);
    if (wob < 0.01) wob = 0;
    var moving = cur !== tgt || spd > 0.05;
    var wetT = moving ? 1 : 0.35;
    wetK += (wetT - wetK) * Math.min(1, 0.03 * f);
    var cT = sample(cur).c;
    cosS += (cT - cosS) * Math.min(1, 0.2 * f);

    stepStates();
    if (cur >= L - 1) {
      if (!finalDone) { finalDone = true; flickAt = ts; }
    } else if (cur < L - 40) {
      finalDone = false;
    }
    draw(ts);

    if (cur !== tgt || wob > 0 || flickAt >= 0 || Math.abs(wetK - wetT) > 0.01 || Math.abs(cosS - cT) > 0.003) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function kick() {
    if (running || mq.matches || !L) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- события ---------- */
  function onScroll() {
    if (scrollQueued || mq.matches) return;
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      calcTarget();
      kick();
    });
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
  if (mq.addEventListener) mq.addEventListener('change', build);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { calcTarget(); kick(); }
  });

  P.on('stages', function (d) {
    if (!P.editing) P.fill('stages');
    if (d.items && d.items.length) renderSteps(d.items);
    build();
  });

  build();
})();
