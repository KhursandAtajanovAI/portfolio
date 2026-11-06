/* Контакты и форма заказа. Данные: content/contacts.json.
   GitHub Pages статический и письмо отправить не может, поэтому:
   - если в contacts.json заполнен form_endpoint (Formspree или Web3Forms), заявка уходит POST-запросом туда;
   - если пусто, отправка не имитируется: показываем честное сообщение и кнопки Telegram и WhatsApp с текстом заявки.
   Введённые данные нигде не сохраняются. */
(function () {
  'use strict';

  var P = window.Portfolio;
  var form = document.getElementById('orderform');
  if (!P || !form) return;

  function $(id) { return document.getElementById(id); }
  var same = $('f-same'), waWrap = $('f-wa-wrap'), waInput = $('f-wa');
  var status = $('f-status'), actions = $('f-actions'), sendBtn = $('f-send');

  function contacts() { return P.data.contacts || {}; }
  function isTodo(v) { return !v || /добавить/i.test(v); }
  function digits(s) { return (s || '').replace(/\D/g, ''); }
  function phoneOk(v) { var n = digits(v).length; return n >= 10 && n <= 15; }

  /* ---------- ссылки на контакты ---------- */
  function tgUrl(v) {
    if (isTodo(v)) return '';
    v = v.trim();
    if (/^https?:\/\//i.test(v)) return v;
    v = v.replace(/^@/, '').replace(/^t\.me\//i, '');
    return /^[A-Za-z0-9_]{4,32}$/.test(v) ? 'https://t.me/' + v : '';
  }
  function waUrl(v, text) {
    if (isTodo(v)) return '';
    var d = digits(v);
    return d.length >= 10 ? 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '') : '';
  }
  var LINKS = {
    phone: function (v) { return phoneOk(v) ? 'tel:' + v.replace(/[^\d+]/g, '') : ''; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? 'mailto:' + v : ''; },
    telegram: tgUrl,
    whatsapp: function (v) { return waUrl(v); }
  };

  function renderContacts() {
    var d = contacts();
    if (!P.editing) {
      P.fill('contacts');
      var lead = document.querySelector('.ogrid h3[data-path="lead"]');
      if (lead && d.lead) {
        var words = d.lead.split(' ');
        lead.textContent = '';
        var sp = document.createElement('span');
        sp.textContent = words.shift();
        lead.appendChild(sp);
        lead.appendChild(document.createTextNode(words.length ? ' ' + words.join(' ') : ''));
      }
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-contact]'), function (n) {
      if (P.editing) return;
      var kind = n.dataset.contact, v = d[kind];
      if (v == null) return;
      if (isTodo(v)) { P.setText(n, (n.dataset.label || '') + ': ' + (v || 'добавить'), ''); return; }
      P.setText(n, v, LINKS[kind] ? LINKS[kind](v) : '');
    });
  }

  /* ---------- валидация ---------- */
  var RULES = [
    { id: 'f-email', ok: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }, msg: 'Укажите email в формате name@example.com.' },
    { id: 'f-phone', ok: function (v) { return phoneOk(v); }, msg: 'Укажите номер телефона, от 10 цифр (например, +7 700 000 00 00).' },
    { id: 'f-wa', ok: function (v) { return phoneOk(v); }, msg: 'Укажите номер WhatsApp или отметьте «WhatsApp на том же номере».', skip: function () { return same.checked; } },
    { id: 'f-msg', ok: function (v) { return v.trim().length > 0; }, msg: 'Напишите сообщение.' }
  ];

  function setError(id, msg) {
    var f = $(id), e = $(id + '-err');
    f.classList.toggle('bad', !!msg);
    if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
    e.hidden = !msg;
    e.textContent = msg || '';
  }

  function validate() {
    var first = null;
    RULES.forEach(function (r) {
      var bad = !(r.skip && r.skip()) && !r.ok($(r.id).value);
      setError(r.id, bad ? r.msg : '');
      if (bad && !first) first = $(r.id);
    });
    return first;
  }

  RULES.forEach(function (r) {
    $(r.id).addEventListener('input', function () { if ($(r.id).classList.contains('bad')) setError(r.id, ''); });
  });

  same.addEventListener('change', function () {
    waWrap.hidden = same.checked;
    waInput.disabled = same.checked;
    if (same.checked) setError('f-wa', '');
  });

  /* ---------- заявка ---------- */
  function values() {
    var svc = $('f-service');
    return {
      name: $('f-name').value.trim(),
      email: $('f-email').value.trim(),
      phone: $('f-phone').value.trim(),
      whatsapp: same.checked ? $('f-phone').value.trim() : waInput.value.trim(),
      service: svc.value,
      social: $('f-social').value.trim(),
      message: $('f-msg').value.trim()
    };
  }

  function compose(v) {
    var lines = ['Здравствуйте! Заявка с сайта.'];
    if (v.service) lines.push('Услуга: ' + v.service);
    if (v.name) lines.push('Имя: ' + v.name);
    lines.push('Email: ' + v.email, 'Телефон: ' + v.phone, 'WhatsApp: ' + v.whatsapp);
    if (v.social) lines.push('Соцсети: ' + v.social);
    lines.push('', v.message);
    return lines.join('\n');
  }

  function say(text) { status.textContent = text; }

  function actionButton(label, url, onclick) {
    var b;
    if (url) {
      b = document.createElement('a');
      b.href = url;
      b.target = '_blank';
      b.rel = 'noopener';
      if (onclick) b.addEventListener('click', onclick);
    } else {
      b = document.createElement('button');
      b.type = 'button';
      b.disabled = true;
      b.title = 'Контакт не указан в content/contacts.json';
    }
    b.className = 'actbtn';
    b.textContent = label;
    return b;
  }

  // Конкретные кнопки мессенджеров с текстом заявки. Telegram не умеет принимать текст в ссылке на профиль,
  // поэтому текст копируется в буфер, а ниже всегда показан для ручного копирования.
  function showMessengers(v) {
    var text = compose(v), c = contacts();
    actions.hidden = false;
    actions.textContent = '';
    var row = document.createElement('div');
    row.className = 'actions';
    row.appendChild(actionButton('Написать в Telegram', tgUrl(c.telegram), function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { say('Текст заявки скопирован. Вставьте его в чат Telegram.'); },
          function () { say('Не удалось скопировать автоматически: возьмите текст из поля ниже.'); }
        );
      }
    }));
    row.appendChild(actionButton('Написать в WhatsApp', waUrl(c.whatsapp, text)));
    actions.appendChild(row);
    var box = document.createElement('div');
    box.className = 'copybox';
    var lab = document.createElement('label');
    lab.htmlFor = 'f-copy';
    lab.textContent = 'Текст заявки (можно скопировать вручную)';
    var ta = document.createElement('textarea');
    ta.className = 'field';
    ta.id = 'f-copy';
    ta.readOnly = true;
    ta.value = text;
    box.appendChild(lab);
    box.appendChild(ta);
    actions.appendChild(box);
  }

  function send(endpoint, v) {
    var c = contacts(), fd = new FormData();
    Object.keys(v).forEach(function (k) { fd.append(k, v[k]); });
    fd.append('_subject', 'Заявка с сайта');
    fd.append('_replyto', v.email);
    if (c.form_access_key) fd.append('access_key', c.form_access_key);
    sendBtn.disabled = true;
    say('Отправляем…');
    fetch(endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          return r.ok && j.ok !== false && j.success !== false;
        });
      })
      .catch(function () { return false; })
      .then(function (ok) {
        sendBtn.disabled = false;
        if (ok) {
          actions.hidden = true;
          form.reset();
          waWrap.hidden = false;
          waInput.disabled = false;
          say('Спасибо! Заявка отправлена, я отвечу на email или телефон.');
        } else {
          say('Не удалось отправить заявку. Попробуйте позже или напишите напрямую:');
          showMessengers(v);
        }
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    actions.hidden = true;
    var bad = validate();
    if (bad) {
      say('Проверьте отмеченные поля: ' + RULES.filter(function (r) { return $(r.id).classList.contains('bad'); }).length + ' шт.');
      bad.focus();
      return;
    }
    // скрытое поле-ловушка заполняют только боты: делаем вид, что всё хорошо, и ничего не отправляем
    if (form.elements._gotcha.value) { say('Спасибо! Заявка отправлена.'); return; }
    var v = values(), endpoint = (contacts().form_endpoint || '').trim();
    if (!endpoint) {
      say('Отправка формы с сайта пока не подключена, поэтому заявка никуда не ушла. ' +
          'Нажмите кнопку мессенджера: текст заявки подставится сам (в Telegram его нужно вставить из буфера).');
      showMessengers(v);
    } else if (!/^https:\/\//i.test(endpoint)) {
      say('Адрес приёма формы указан неверно (нужен https://…, см. form_endpoint в content/contacts.json). Можно написать напрямую:');
      showMessengers(v);
    } else {
      send(endpoint, v);
    }
  });

  P.on('contacts', renderContacts);
})();
