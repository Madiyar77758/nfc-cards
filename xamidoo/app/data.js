/* ============================================================
   Xami_Doo — общий слой данных для хаба, меню и админки.
   Меню приходит из воркера; если воркер не отвечает или ещё не
   развёрнут, страница показывает файл из репозитория. Гость никогда
   не видит пустой экран — в худшем случае видит вчерашние цены.
   ============================================================ */
(function (global) {
  'use strict';

  var CFG = global.XD_CONFIG || { API_BASE: '', SLUG: 'xamidoo' };
  var LANG_KEY = 'xd-lang';
  var TOKEN_KEY = 'xd-token';
  var OK_LANG = { ru: 1, kk: 1, en: 1 };

  /* ---------- язык ---------- */

  function pickLang() {
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
    if (saved && OK_LANG[saved]) return saved;
    var n = (navigator.language || 'ru').toLowerCase();
    if (n.indexOf('kk') === 0) return 'kk';
    if (n.indexOf('en') === 0) return 'en';
    return 'ru';
  }

  function setLang(lang, save) {
    if (!OK_LANG[lang]) lang = 'ru';
    var root = document.documentElement;
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    if (save) { try { localStorage.setItem(LANG_KEY, lang); } catch (e) {} }
    global.XD_LANG = lang;
    var box = document.getElementById('lang');
    if (box) {
      var b = box.getElementsByTagName('button');
      for (var i = 0; i < b.length; i++) {
        var on = b[i].getAttribute('data-set') === lang;
        b[i].className = on ? 'on' : '';
        b[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
    if (typeof global.onLangChange === 'function') global.onLangChange(lang);
  }

  function initLang() {
    setLang(pickLang(), false);
    var box = document.getElementById('lang');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== box && t.tagName !== 'BUTTON') t = t.parentNode;
      if (t && t.tagName === 'BUTTON') setLang(t.getAttribute('data-set'), true);
    });
  }

  /* ---------- цены ---------- */

  // 2000 -> «2 000 ₸». Узкий пробел, чтобы цена не разрывалась переносом.
  function money(v) {
    var n = Math.round(Number(v) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸';
  }

  /* ---------- акции ---------- */

  function toMin(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }

  // Акция действует, если включена и совпали дата, день недели и часы.
  function isLive(promo, now) {
    if (!promo || promo.on === false) return false;
    now = now || new Date();

    var ymd = now.getFullYear() + '-' +
      ('0' + (now.getMonth() + 1)).slice(-2) + '-' +
      ('0' + now.getDate()).slice(-2);
    if (promo.from && ymd < promo.from) return false;
    if (promo.to && ymd > promo.to) return false;

    if (promo.days && promo.days.length) {
      var dow = now.getDay() || 7;               // вс=0 в JS, у нас вс=7
      if (promo.days.indexOf(dow) === -1) return false;
    }

    if (promo.hours) {
      var p = String(promo.hours).split('-');
      var a = toMin(p[0]), b = toMin(p[1]);
      if (a !== null && b !== null) {
        var cur = now.getHours() * 60 + now.getMinutes();
        // интервал может переходить через полночь
        var inside = (b > a) ? (cur >= a && cur < b) : (cur >= a || cur < b);
        if (!inside) return false;
      }
    }
    return true;
  }

  function livePromos(data, now) {
    var list = (data && data.promos) || [];
    var out = [];
    for (var i = 0; i < list.length; i++) if (isLive(list[i], now)) out.push(list[i]);
    return out;
  }

  function hits(promo, itemId, sectionId) {
    if (promo.scope === 'items') return (promo.items || []).indexOf(itemId) !== -1;
    if (promo.scope === 'section') return (promo.sections || []).indexOf(sectionId) !== -1;
    return true;                                  // scope === 'all'
  }

  // Из нескольких подходящих акций берём самую выгодную для гостя.
  function promoFor(promos, itemId, sectionId) {
    var best = null;
    for (var i = 0; i < promos.length; i++) {
      var p = promos[i];
      if (!hits(p, itemId, sectionId)) continue;
      if (!best || Number(p.percent) > Number(best.percent)) best = p;
    }
    return best;
  }

  // Возвращает и новую цену, и старую — чтобы показать зачёркнутой.
  function priceOf(item, promo) {
    var base = Number(item.price) || 0;
    if (!promo || !Number(promo.percent)) return { now: base, was: 0, percent: 0 };
    var cut = Math.round(base * (1 - Number(promo.percent) / 100) / 10) * 10;
    if (cut >= base || cut <= 0) return { now: base, was: 0, percent: 0 };
    return { now: cut, was: base, percent: Number(promo.percent) };
  }

  /* ---------- обмен с воркером ---------- */

  function api(path) { return CFG.API_BASE.replace(/\/+$/, '') + path; }
  function hasApi() { return !!CFG.API_BASE; }

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function jsonFetch(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (body) {
        var data = null;
        try { data = body ? JSON.parse(body) : null; } catch (e) {}
        if (!r.ok) {
          var err = new Error((data && data.error) || ('HTTP ' + r.status));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  /* base — путь к папке заведения относительно страницы ('' для корня,
     '../' для /menu/ и /admin/). Нужен, чтобы найти запасной menu.json. */
  function load(base) {
    var seed = (base || '') + 'data/menu.json?v=' + Date.now();
    var fallback = function (why) {
      return jsonFetch(seed, { cache: 'no-store' }).then(function (d) {
        d.__source = 'file';
        d.__why = why;
        return d;
      });
    };
    if (!hasApi()) return fallback('api-not-configured');
    return jsonFetch(api('/v1/menu?c=' + encodeURIComponent(CFG.SLUG)), { cache: 'no-store' })
      .then(function (d) { d.__source = 'api'; return d; })
      .catch(function (e) { return fallback(e.message || 'api-failed'); });
  }

  function login(pass) {
    if (!hasApi()) return Promise.reject(new Error('API_BASE не задан в app/config.js'));
    return jsonFetch(api('/v1/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ c: CFG.SLUG, pass: pass })
    }).then(function (r) { setToken(r.token); return r; });
  }

  function save(data) {
    if (!hasApi()) return Promise.reject(new Error('API_BASE не задан в app/config.js'));
    return jsonFetch(api('/v1/menu?c=' + encodeURIComponent(CFG.SLUG)), {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + getToken() },
      body: JSON.stringify(data)
    });
  }

  /* ---------- мелочи ---------- */

  /* Системная кнопка «назад» на телефоне закрывает страницу целиком —
     для гостя это выглядит как вылет из меню, хотя он всего лишь хотел
     закрыть фотографию или редактор. Пока поверх страницы что-то открыто,
     держим для этого отдельную запись в истории: «назад» съедает её,
     а не уводит с сайта.

     onBack вызывается, когда закрыли системной кнопкой. Возвращённую
     функцию вызывают, когда закрыли из интерфейса, — она убирает запись,
     чтобы «назад» потом не срабатывала вхолостую. */
  function trapBack(onBack) {
    var popped = false;
    // Браузер сам возвращает прокрутку при переходе по истории. Наш
    // history.back() при закрытии — тоже переход, и он откатывал страницу
    // наверх сразу после того, как мы перевели её на выбранный раздел.
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
    try { history.pushState({ xdOverlay: 1 }, ''); } catch (e) { return function () {}; }

    function pop() {
      popped = true;
      window.removeEventListener('popstate', pop);
      onBack();
    }
    window.addEventListener('popstate', pop);

    return function release() {
      if (popped) return;                 // запись уже съедена кнопкой «назад»
      window.removeEventListener('popstate', pop);
      history.back();
    };
  }

  var toastTimer;
  function toast(text, bad) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 2200);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var i = document.createElement('input');
      i.value = text;
      i.setAttribute('readonly', '');
      i.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(i);
      i.select();
      i.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(i);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Заголовок раздела на текущем языке; если перевода нет — русский.
  function t(title) {
    if (!title) return '';
    if (typeof title === 'string') return title;
    return title[global.XD_LANG || 'ru'] || title.ru || '';
  }

  global.XD = {
    cfg: CFG, hasApi: hasApi,
    initLang: initLang, setLang: setLang,
    money: money, esc: esc, t: t,
    isLive: isLive, livePromos: livePromos, promoFor: promoFor, priceOf: priceOf,
    load: load, login: login, save: save, getToken: getToken, setToken: setToken,
    toast: toast, copy: copy, trapBack: trapBack
  };
})(window);
