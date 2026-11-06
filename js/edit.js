/* Режим редактирования. Подгружается из main.js, только если адрес открыт с #edit.
   Поля с data-path превращаются в textarea, которая растёт вместе с текстом.
   Списки (работы, проекты, креатив, интересы, этапы) правятся в панелях под своими разделами.
   Изменения живут только в браузере: «Скачать JSON» сохраняет файлы, их кладут в content/. */
(function () {
  'use strict';

  var P = window.Portfolio;
  if (!P || P.editing) return;
  P.editing = true;
  document.body.classList.add('editing');

  var changed = {};
  var fields = [];
  var bar, status, filesBox;

  // Списки: какие поля у записи, какие значения по умолчанию у новой.
  var KIND_A = [['draw', 'рисунок'], ['ba', 'до и после'], ['result', 'результат']];
  var KIND_B = [['site', 'сайт'], ['ml', 'ML'], ['it', 'IT-задача'], ['project', 'проект']];
  var KIND_C = [['startup', 'Стартапы'], ['shop', 'Магазин'], ['charity', 'Благотворительность'], ['invest', 'Вклады']];
  var PANELS = [
    { file: 'projects', host: '#deeds .wrap', title: 'Проекты (барабан и список)', list: 'items',
      blank: { title: 'добавить', kind: 'project', url: '' },
      fields: [['title', 'Название'], ['kind', 'Вид', KIND_B], ['url', 'Ссылка']] },
    { file: 'creative', host: '#deeds .wrap', title: 'Креативные работы', list: 'items',
      blank: { kind: 'draw', title: 'добавить', image: '' },
      fields: [['kind', 'Вид', KIND_A], ['title', 'Название'], ['image', 'Картинка (images/…)'],
               ['before', 'До (для «до и после»)'], ['after', 'После (для «до и после»)']] },
    { file: 'interests', host: '#deeds .wrap', title: 'Таблица «Что у меня есть»', list: 'items',
      blank: { kind: 'startup', text: 'добавить', url: '' },
      fields: [['kind', 'Вид', KIND_C], ['text', 'Текст'], ['url', 'Ссылка («Подробнее»)']] },
    { file: 'stages', host: '#flow .wrap', title: 'Этапы', list: 'items',
      blank: { title: 'добавить', text: 'добавить' },
      fields: [['title', 'Заголовок'], ['text', 'Текст']] },
    { file: 'contacts', host: '#order .wrap', title: 'Приём формы',
      fields: [['form_endpoint', 'Адрес приёма формы (https://formspree.io/f/…)'],
               ['form_access_key', 'Ключ Web3Forms (только если нужен)']] }
  ];

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

  function downloadFiles(names) {
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
      delete changed[name];
      var b = filesBox.querySelector('[data-file="' + name + '"]');
      if (b) b.remove();
    });
    status.textContent = 'Скачано: ' + names.map(function (n) { return n + '.json'; }).join(', ');
    pad();
  }

  function markChanged(file) {
    if (!changed[file]) {
      changed[file] = true;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-btn small';
      b.dataset.file = file;
      b.textContent = 'Скачать JSON: ' + file + '.json';
      b.addEventListener('click', function () { downloadFiles([file]); });
      filesBox.appendChild(b);
      pad();
    }
    status.textContent = 'Изменено файлов: ' + Object.keys(changed).length;
  }

  function field(file, path, label, onchange) {
    var t = document.createElement('textarea');
    t.className = 'ed-field';
    t.rows = 1;
    t.value = get(file, path);
    t.setAttribute('aria-label', label);
    t.addEventListener('input', function () {
      set(file, path, t.value);
      markChanged(file);
      fit(t);
      if (onchange) onchange();
    });
    fields.push(t);
    return t;
  }

  function select(file, path, label, options, onchange) {
    var s = document.createElement('select');
    s.setAttribute('aria-label', label);
    options.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0];
      op.textContent = o[1];
      s.appendChild(op);
    });
    s.value = get(file, path);
    s.addEventListener('change', function () {
      set(file, path, s.value);
      markChanged(file);
      if (onchange) onchange();
    });
    return s;
  }

  function enhance(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-path]'), function (el) {
      if (el.querySelector('textarea') || !P.data[el.dataset.file]) return;
      var file = el.dataset.file, path = el.dataset.path;
      el.textContent = '';
      el.classList.remove('todo', 'fallback');
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

  /* ---------- панели списков ---------- */
  function panel(spec) {
    var d = P.data[spec.file];
    var host = document.querySelector(spec.host);
    if (!d || !host) return;
    var box = document.createElement('details');
    box.className = 'ed-panel';
    box.open = true;
    var sum = document.createElement('summary');
    sum.textContent = spec.title + ' (' + spec.file + '.json)';
    var body = document.createElement('div');
    box.appendChild(sum);
    box.appendChild(body);
    host.appendChild(box);

    var timer;
    function refresh() {
      clearTimeout(timer);
      timer = setTimeout(function () { P.render(spec.file); }, 200);
    }

    function row(base) {
      var r = document.createElement('div');
      r.className = 'ed-row';
      spec.fields.forEach(function (f) {
        var path = base + f[0];
        var lab = document.createElement('label');
        lab.appendChild(document.createTextNode(f[1]));
        lab.appendChild(f[2] ? select(spec.file, path, f[1], f[2], refresh) : field(spec.file, path, f[1], refresh));
        r.appendChild(lab);
      });
      return r;
    }

    function draw() {
      fields = fields.filter(function (t) { return !body.contains(t); });
      body.textContent = '';
      if (!spec.list) { body.appendChild(row('')); fitAll(); return; }
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'ed-btn';
      add.textContent = '+ Добавить запись сверху';
      add.addEventListener('click', function () {
        d[spec.list].unshift(JSON.parse(JSON.stringify(spec.blank)));
        markChanged(spec.file);
        draw();
        P.render(spec.file);
        var t = body.querySelector('textarea');
        if (t) t.focus();
      });
      body.appendChild(add);
      d[spec.list].forEach(function (_, i) {
        var r = row(spec.list + '.' + i + '.');
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'ed-btn small';
        del.textContent = 'Удалить запись';
        del.addEventListener('click', function () {
          if (!window.confirm('Удалить эту запись?')) return;
          d[spec.list].splice(i, 1);
          markChanged(spec.file);
          draw();
          P.render(spec.file);
        });
        r.appendChild(del);
        body.appendChild(r);
      });
      fitAll();
    }
    draw();
  }

  // Записи «Путь и работы» (верхняя часть): добавить сверху и удалить.
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
    filesBox = document.createElement('div');
    filesBox.className = 'ed-files';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ed-btn primary';
    b.textContent = 'Скачать JSON';
    b.addEventListener('click', function () {
      var names = Object.keys(changed);
      if (!names.length) { status.textContent = 'Изменений нет'; return; }
      downloadFiles(names);
    });
    bar.appendChild(status);
    bar.appendChild(filesBox);
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
  PANELS.forEach(panel);
  pad();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitAll(); pad(); });
})();
