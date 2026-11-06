/* «Барабан» проектов: крутится мышью, пальцем, колесом, кнопками и стрелками, зациклен,
   края растворяются, центральный элемент подсвечен и нажимается.
   Наполняется из filters.js через Portfolio.drum.setItems([{title, url}]). */
(function () {
  'use strict';

  var P = window.Portfolio;
  var box = document.getElementById('drum');
  var track = document.getElementById('dtrack');
  if (!P || !box || !track) return;

  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  // у кнопки «Заказать» есть SMIL-анимация градиента: при reduced motion её убираем
  if (mq.matches) {
    Array.prototype.forEach.call(document.querySelectorAll('.cta animate'), function (a) { a.remove(); });
  }

  var els = [], pos = 0, target = 0, raf = 0, slot = 200;
  var moved = 0, dragging = false, sx = 0, sp = 0, lastX = 0, lastT = 0, vel = 0, lastWheel = 0;

  function mod(a, n) { return ((a % n) + n) % n; }
  function calcSlot() { slot = box.clientWidth < 560 ? 150 : 200; }

  function layout() {
    var n = els.length;
    if (!n) return;
    for (var i = 0; i < n; i++) {
      var el = els[i], d = mod(i - pos + n / 2, n) - n / 2, ad = Math.abs(d);
      if (ad > 3.4) {
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        el.tabIndex = -1;
        continue;
      }
      el.style.visibility = 'visible';
      el.style.pointerEvents = 'auto';
      el.style.transform = 'translate(-50%,-50%) translateX(' + (d * slot) + 'px) rotateY(' + (-d * 26) + 'deg) scale(' + (1 - 0.1 * ad) + ')';
      el.style.opacity = Math.max(0, 1 - 0.26 * ad);
      el.style.zIndex = 100 - Math.round(ad * 10);
      var cur = ad < 0.5;
      el.classList.toggle('cur', cur);
      el.tabIndex = cur ? 0 : -1;
      if (cur) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
    }
  }

  function tick() {
    raf = 0;
    var diff = target - pos;
    if (mq.matches || Math.abs(diff) < 0.002) { pos = target; layout(); return; }
    pos += diff * 0.16;
    layout();
    raf = requestAnimationFrame(tick);
  }

  function go(t) {
    target = t;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // после клавиши фокус переезжает на новый центральный элемент
  function focusCurrent() {
    var n = els.length;
    if (!n) return;
    var el = els[mod(Math.round(target), n)];
    el.tabIndex = 0;
    el.focus({ preventScroll: true });
  }

  function setItems(list) {
    var keep = els.length === list.length && list.length > 0;
    var oldPos = pos, oldTarget = target;
    track.textContent = '';
    els = [];
    if (!list.length) {
      var e = document.createElement('div');
      e.className = 'dempty';
      e.textContent = 'Пока пусто';
      track.appendChild(e);
      return;
    }
    list.forEach(function (p, i) {
      var a = document.createElement('a');
      a.className = 'ditem';
      a.href = p.url || '#projects';
      if (p.url) a.rel = 'noopener';
      a.textContent = p.title;
      a.draggable = false;
      a.dataset.i = i;
      track.appendChild(a);
      els.push(a);
    });
    pos = keep ? oldPos : 0;
    target = keep ? oldTarget : 0;
    calcSlot();
    layout();
  }

  box.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    dragging = true;
    moved = 0;
    sx = e.clientX;
    sp = pos;
    lastX = sx;
    lastT = performance.now();
    vel = 0;
    box.classList.add('grab');
  });

  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - sx;
    moved = Math.max(moved, Math.abs(dx));
    pos = sp - dx / slot;
    target = pos;
    layout();
    var now = performance.now();
    vel = (lastX - e.clientX) / slot / Math.max(1, now - lastT) * 16;
    lastX = e.clientX;
    lastT = now;
  });

  function end() {
    if (!dragging) return;
    dragging = false;
    box.classList.remove('grab');
    go(Math.round(pos + vel * 6));
  }
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  // клик по центральному элементу открывает ссылку, по боковому прокручивает к нему
  track.addEventListener('click', function (e) {
    var a = e.target.closest('.ditem');
    if (!a) return;
    if (moved > 6) { e.preventDefault(); return; }
    var n = els.length, d = mod(+a.dataset.i - pos + n / 2, n) - n / 2;
    if (Math.abs(d) >= 0.5) { e.preventDefault(); go(Math.round(pos + d)); }
  });

  box.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      var now = Date.now();
      if (now - lastWheel < 140) return;
      lastWheel = now;
      go(Math.round(target) + (e.deltaX > 0 ? 1 : -1));
    }
  }, { passive: false });

  box.addEventListener('keydown', function (e) {
    var step = 0;
    if (e.key === 'ArrowRight') step = 1;
    else if (e.key === 'ArrowLeft') step = -1;
    else if (e.key === 'Home') step = -Math.round(target);
    else return;
    e.preventDefault();
    go(Math.round(target) + step);
    focusCurrent();
  });

  document.getElementById('dprev').addEventListener('click', function () { go(Math.round(target) - 1); });
  document.getElementById('dnext').addEventListener('click', function () { go(Math.round(target) + 1); });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { calcSlot(); layout(); }, 80);
  });

  P.drum = { setItems: setItems };
})();
