/* Подставляет тексты из content/*.json в страницу.
   Если файл не загрузился, в разметке остаётся текст-заглушка. */
(function () {
  'use strict';

  var page = document.body.dataset.page;
  // версия из адреса этого скрипта (?v=...): тянем edit.js той же версии, чтобы не попасть на старый кеш
  var VER = (document.currentScript && document.currentScript.src.split('?')[1]) || '';
  var FILES = page === 'home'
    ? ['profile', 'now', 'about', 'works', 'skills', 'hours', 'links',
       'deeds', 'projects', 'creative', 'interests', 'stages', 'contacts']
    : ['works']; // на остальных страницах нужен только список работ для подменю
  var DATA = {};
  var HANDLERS = {};
  var P = window.Portfolio = {
    data: DATA, editing: false, render: render, fill: fill, setText: setText,
    // js/*.js регистрируют отрисовку своих файлов: P.on('projects', function (data) {...})
    on: function (name, fn) { (HANDLERS[name] = HANDLERS[name] || []).push(fn); }
  };

  function $(sel) { return document.querySelector(sel); }

  // Создаёт элемент с текстом; file/path нужны режиму редактирования (js/edit.js).
  function node(tag, cls, text, file, path) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    setText(n, text, '');
    if (file) { n.dataset.file = file; n.dataset.path = path; }
    return n;
  }

  // Текст, а если задан адрес, то ссылкой.
  function setText(n, text, url) {
    n.textContent = '';
    text = text || '';
    if (url) {
      var a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      a.textContent = text;
      n.appendChild(a);
    } else {
      n.textContent = text;
    }
    n.classList.toggle('todo', /добавить/i.test(text));
  }

  function getPath(o, path) {
    path.split('.').forEach(function (k) { o = o == null ? o : o[k]; });
    return o;
  }

  // Подставляет в разметку тексты из файла: элементы с data-file и data-path.
  function fill(file, root) {
    var d = DATA[file];
    if (!d) return;
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-file="' + file + '"][data-path]'), function (n) {
      var v = getPath(d, n.dataset.path);
      if (v == null) return;
      setText(n, v, '');
      n.classList.remove('fallback');
    });
  }

  function section(c, title, file) {
    c.textContent = '';
    c.appendChild(node('h2', '', title, file, 'title'));
  }

  function paragraphs(file, c) {
    return function (d) {
      section(c, d.title, file);
      (d.paragraphs || []).forEach(function (t, i) {
        c.appendChild(node('p', '', t, file, 'paragraphs.' + i));
      });
    };
  }

  var R = {
    profile: function (d) {
      var c = $('#bn-text');
      c.textContent = '';
      c.appendChild(node('h1', '', d.name, 'profile', 'name'));
      if (d.subtitle) c.appendChild(node('p', 'bn-sub', d.subtitle, 'profile', 'subtitle'));
      (d.lead || []).forEach(function (t, i) {
        c.appendChild(node('p', '', t, 'profile', 'lead.' + i));
      });
      var row = document.createElement('div');
      row.className = 'bn-actions';
      (d.buttons || []).forEach(function (btn, i) {
        var b = node('a', i === 0 ? 'btn' : 'btn alt', btn.text, 'profile', 'buttons.' + i + '.text');
        b.href = btn.href || '#works';
        b.dataset.urlPath = 'buttons.' + i + '.href';
        row.appendChild(b);
      });
      if (row.children.length) c.appendChild(row);
    },

    now: function (d) {
      var c = $('#now');
      section(c, d.title, 'now');
      (d.items || []).forEach(function (it, i) {
        var w = document.createElement('div');
        w.className = 'it';
        w.appendChild(node('span', 'lab', it.label, 'now', 'items.' + i + '.label'));
        w.appendChild(node('p', '', it.text, 'now', 'items.' + i + '.text'));
        c.appendChild(w);
      });
    },

    about: function (d) { paragraphs('about', $('#who'))(d); },
    skills: function (d) {
      var c = $('#skills');
      section(c, d.title, 'skills');
      var ol = document.createElement('ol');
      ol.className = 'slist';
      (d.items || []).forEach(function (it, i) {
        var li = document.createElement('li');
        li.appendChild(node('strong', '', it.title, 'skills', 'items.' + i + '.title'));
        li.appendChild(document.createTextNode(' '));
        li.appendChild(node('span', '', it.text, 'skills', 'items.' + i + '.text'));
        ol.appendChild(li);
      });
      c.appendChild(ol);
    },

    works: function (d) {
      var c = $('#works');
      section(c, d.title, 'works');
      var ul = document.createElement('ul');
      ul.className = 'tl';
      (d.entries || []).forEach(function (e, i) {
        var base = 'entries.' + i + '.';
        var li = document.createElement('li');
        li.id = 'work-' + i;
        li.appendChild(node('span', 'tl-date', e.date, 'works', base + 'date'));
        var h = node('h3', 'tl-title', '', 'works', base + 'title');
        h.dataset.urlPath = base + 'url';
        setText(h, e.title, e.url);
        li.appendChild(h);
        li.appendChild(node('p', 'tl-text', e.text, 'works', base + 'text'));
        ul.appendChild(li);
      });
      c.appendChild(ul);
    },

    hours: function (d) {
      var c = $('#hours');
      section(c, d.title, 'hours');
      (d.rows || []).forEach(function (r, i) {
        var row = document.createElement('div');
        row.className = 'row';
        row.appendChild(node('span', 'lab', r.label, 'hours', 'rows.' + i + '.label'));
        row.appendChild(node('span', '', r.value, 'hours', 'rows.' + i + '.value'));
        c.appendChild(row);
      });
    },

    links: function (d) {
      var c = $('#links');
      section(c, d.title, 'links');
      var lines = document.createElement('div');
      lines.className = 'lines';
      (d.lines || []).forEach(function (l, i) {
        var p = node('p', '', '', 'links', 'lines.' + i + '.text');
        p.dataset.urlPath = 'lines.' + i + '.url';
        setText(p, l.text, l.url);
        lines.appendChild(p);
      });
      c.appendChild(lines);
      var chips = document.createElement('div');
      chips.className = 'chips';
      (d.chips || []).forEach(function (ch, i) {
        var a = node(ch.url ? 'a' : 'span', 'chip', ch.label, 'links', 'chips.' + i + '.label');
        a.dataset.urlPath = 'chips.' + i + '.url';
        if (ch.url) { a.href = ch.url; a.rel = 'noopener'; }
        chips.appendChild(a);
      });
      c.appendChild(chips);
    }
  };

  function render(name) {
    var d = DATA[name];
    if (!d) return;
    if (page === 'home' && R[name]) R[name](d);
    (HANDLERS[name] || []).forEach(function (fn) { fn(d); });
    if (name === 'works') buildSubmenu();
  }

  // Подменю «Работы» собирается из записей works.json.
  function buildSubmenu() {
    var ul = $('.menu .sub');
    var d = DATA.works;
    if (!ul || !d || !d.entries || !d.entries.length) return;
    var base = page === 'home' ? '' : 'index.html';
    ul.textContent = '';
    d.entries.forEach(function (e, i) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = base + '#work-' + i;
      a.textContent = e.title;
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  function load(name) {
    return fetch('content/' + name + '.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) { DATA[name] = d; })
      .catch(function (err) {
        console.warn('content/' + name + '.json не загружен:', err.message || err);
      });
  }

  // Меню с клавиатуры: подменю открывается по Tab, Esc закрывает.
  function initMenu() {
    Array.prototype.forEach.call(document.querySelectorAll('.menu>li'), function (li) {
      li.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        li.classList.add('closed');
        var a = li.querySelector('a');
        if (a) a.focus();
      });
      li.addEventListener('mouseleave', function () { li.classList.remove('closed'); });
      li.addEventListener('focusout', function (e) {
        if (!li.contains(e.relatedTarget)) li.classList.remove('closed');
      });
    });
  }

  // Режим редактирования включается адресом с #edit и подгружает js/edit.js.
  function maybeEdit() {
    if (!document.body.hasAttribute('data-editable') || P.editLoaded) return;
    if (!/^#edit/.test(location.hash)) return;
    P.editLoaded = true;
    var s = document.createElement('script');
    s.src = 'js/edit.js' + (VER ? '?' + VER : '');
    document.head.appendChild(s);
  }

  initMenu();
  // ждём и данные, и DOMContentLoaded: к этому моменту выполнены все js/*.js и их обработчики зарегистрированы
  var domReady = new Promise(function (resolve) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolve);
    else resolve();
  });
  Promise.all(FILES.map(load).concat(domReady)).then(function () {
    FILES.forEach(render);
    P.ready = true;
    maybeEdit();
    window.addEventListener('hashchange', maybeEdit);
  });
})();
