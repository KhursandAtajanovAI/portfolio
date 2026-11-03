/* Режим редактирования. Подгружается из main.js, только если адрес открыт с #edit.
   Каждое поле с data-path превращается в textarea, которая растёт вместе с текстом.
   Изменения живут только в браузере: «Скачать JSON» сохраняет файлы, их кладут в content/. */
(function () {
  'use strict';

  var P = window.Portfolio;
  if (!P || P.editing) return;
  P.editing = true;
  document.body.classList.add('editing');

  var changed = {};
  var fields = [];
  var bar, status;

  function keys(path) { return path.split('.'); }

  function get(file, path) {
    var o = P.data[file];
    keys(path).forEach(function (k) { o = o == null ? o : o[k]; });
    return o == null ? '' : o;
  }

  function set(file, path, value) {
    var ks = keys(path), last = ks.pop(), o = P.data[file];
    ks.forEach(function (k) { o = o[k]; });
    o[last] = value;
  }

  function fit(t) {
    t.style.height = 'auto';
    t.style.height = (t.scrollHeight + t.offsetHeight - t.clientHeight) + 'px';
  }

  function fitAll() { fields.forEach(fit); }

  function pad() { document.body.style.paddingBottom = bar.offsetHeight + 'px'; }

  function markChanged(file) {
    changed[file] = true;
    var n = Object.keys(changed).length;
    status.textContent = 'Изменено файлов: ' + n;
  }

  function field(file, path, label) {
    var t = document.createElement('textarea');
    t.className = 'ed-field';
    t.rows = 1;
    t.value = get(file, path);
    t.setAttribute('aria-label', label);
    t.addEventListener('input', function () {
      set(file, path, t.value);
      markChanged(file);
      fit(t);
    });
    fields.push(t);
    return t;
  }

  function enhance(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-path]'), function (el) {
      if (el.querySelector('textarea')) return;
      var file = el.dataset.file, path = el.dataset.path;
      el.textContent = '';
      el.classList.remove('todo');
      el.appendChild(field(file, path, file + ': ' + path));
      if (el.dataset.urlPath) {
        var w = document.createElement('label');
        w.className = 'ed-url';
        w.appendChild(document.createTextNode('Ссылка (можно оставить пустой): '));
        w.appendChild(field(file, el.dataset.urlPath, file + ': ' + el.dataset.urlPath));
        el.insertAdjacentElement('afterend', w);
      }
    });
    fields = fields.filter(function (t) { return document.contains(t); });
    fitAll();
  }

  // Записи «Путь и работы»: добавить сверху и удалить.
  function worksTools() {
    var c = document.getElementById('works');
    var d = P.data.works;
    if (!c || !d) return;
    Array.prototype.forEach.call(c.querySelectorAll('.tl>li'), function (li, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-btn small';
      b.textContent = 'Удалить запись';
      b.addEventListener('click', function () {
        if (!window.confirm('Удалить эту запись?')) return;
        d.entries.splice(i, 1);
        refreshWorks();
      });
      li.appendChild(b);
    });
    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'ed-btn ed-actions';
    add.textContent = '+ Добавить запись сверху';
    add.addEventListener('click', function () {
      d.entries.unshift({ date: 'добавить', title: 'добавить', text: 'добавить', url: '' });
      refreshWorks(true);
    });
    c.appendChild(add);
  }

  function refreshWorks(focusNew) {
    markChanged('works');
    P.render('works');
    enhance(document.getElementById('works'));
    worksTools();
    if (focusNew) {
      var t = document.querySelector('#work-0 textarea');
      if (t) t.focus();
    }
    pad();
  }

  function download() {
    var names = Object.keys(changed);
    if (!names.length) { status.textContent = 'Изменений нет'; return; }
    names.forEach(function (name, i) {
      setTimeout(function () {
        var blob = new Blob([JSON.stringify(P.data[name], null, 2) + '\n'], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }, i * 400);
    });
    status.textContent = 'Скачано: ' + names.map(function (n) { return n + '.json'; }).join(', ');
    changed = {};
  }

  function buildBar() {
    bar = document.createElement('div');
    bar.className = 'editbar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Режим редактирования');
    bar.innerHTML = '<p><strong>Режим редактирования.</strong> Правки сами на сайт не попадают: ' +
      'скачайте JSON, положите файлы в <code>content/</code> и сделайте коммит.</p>';
    status = document.createElement('span');
    status.className = 'ed-status';
    status.setAttribute('aria-live', 'polite');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ed-btn primary';
    b.textContent = 'Скачать JSON';
    b.addEventListener('click', download);
    bar.appendChild(status);
    bar.appendChild(b);
    document.body.appendChild(bar);
  }

  buildBar();

  if (!Object.keys(P.data).length) {
    status.textContent = 'Данные не загружены: запустите сайт через локальный сервер (см. README).';
  }

  // Ссылки внутри редактируемых полей не должны срабатывать при клике.
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-path]') && e.target.closest('a')) e.preventDefault();
  });

  window.addEventListener('beforeunload', function (e) {
    if (Object.keys(changed).length) { e.preventDefault(); e.returnValue = ''; }
  });

  window.addEventListener('resize', function () { fitAll(); pad(); });

  enhance(document);
  worksTools();
  pad();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitAll(); pad(); });
})();
