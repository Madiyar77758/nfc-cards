/* ============================================================
   Меню-API для NFC-карт. Один воркер обслуживает все заведения:
   каждое живёт под своим slug в таблице clients.

     GET  /v1/menu?c=slug      меню для гостя (кэш 30 секунд)
     POST /v1/login            {c, pass} -> {token}
     PUT  /v1/menu?c=slug      сохранить меню (Bearer token)
     POST /v1/password         {c, pass, newPass} сменить пароль
     POST /v1/photo?c=slug     загрузить снимок блюда (Bearer token)
     GET  /v1/photo/slug/имя   отдать снимок гостю (кэш навсегда)
     POST /v1/client           завести заведение (заголовок x-admin-key)
     GET  /v1/health           жив ли воркер

   Развёртывание и заведение клиента — в README.md рядом.
   ============================================================ */

const MAX_BODY = 512 * 1024;          // меню с описаниями не бывает больше
const MAX_PHOTO = 2 * 1024 * 1024;    // браузер сжимает до ~100 КБ, это потолок на всякий
const TOKEN_DAYS = 30;
const PBKDF2_ITERS = 100000;

/* ---------- мелкие помощники ---------- */

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Сравнение без ветвления по значению: иначе время ответа выдаёт префикс.
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-admin-key',
  'access-control-max-age': '86400'
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra }
  });
}

const fail = (status, error) => json({ error }, status);

/* ---------- пароли ---------- */

async function pbkdf2(pass, salt, iters) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, 256
  );
  return new Uint8Array(bits);
}

async function hashPassword(pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pass, salt, PBKDF2_ITERS);
  return `pbkdf2$${PBKDF2_ITERS}$${b64url(salt)}$${b64url(hash)}`;
}

async function checkPassword(pass, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iters = parseInt(parts[1], 10);
  if (!iters || iters > 400000) return false;
  const got = await pbkdf2(pass, unb64url(parts[2]), iters);
  return sameBytes(got, unb64url(parts[3]));
}

/* ---------- токены ---------- */

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function makeToken(secret, slug) {
  const payload = b64url(enc.encode(JSON.stringify({
    c: slug,
    exp: Date.now() + TOKEN_DAYS * 86400000
  })));
  return payload + '.' + b64url(await hmac(secret, payload));
}

async function readToken(secret, token) {
  const dot = String(token || '').indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let want;
  try { want = unb64url(sig); } catch { return null; }
  if (!sameBytes(await hmac(secret, payload), want)) return null;
  let data;
  try { data = JSON.parse(new TextDecoder().decode(unb64url(payload))); } catch { return null; }
  if (!data || !data.c || !data.exp || Date.now() > data.exp) return null;
  return data;
}

function bearer(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

/* ---------- проверка меню ---------- */

// Не даём положить в базу что попало: структуру проверяем, содержимое — нет.
function validMenu(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return 'меню должно быть объектом';
  if (!Array.isArray(m.sections)) return 'нет списка sections';
  if (m.sections.length > 60) return 'слишком много разделов';
  for (const s of m.sections) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.items)) return 'раздел без списка items';
    if (s.items.length > 400) return 'слишком много блюд в разделе';
  }
  if (m.promos && !Array.isArray(m.promos)) return 'promos должен быть списком';
  if (m.place && typeof m.place !== 'object') return 'place должен быть объектом';
  return null;
}

async function readBody(req) {
  const len = parseInt(req.headers.get('content-length') || '0', 10);
  if (len > MAX_BODY) throw new Error('тело запроса слишком большое');
  const text = await req.text();
  if (text.length > MAX_BODY) throw new Error('тело запроса слишком большое');
  try { return JSON.parse(text); } catch { throw new Error('это не JSON'); }
}

const slugOk = (s) => /^[a-z0-9][a-z0-9-]{1,40}$/.test(String(s || ''));

/* ---------- маршруты ---------- */

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/v1/health' || path === '/') {
      return json({ ok: true, service: 'nfc-menu', time: new Date().toISOString() });
    }

    if (!env.DB) return fail(500, 'база D1 не привязана к воркеру');
    const secret = env.TOKEN_SECRET;
    if (!secret) return fail(500, 'не задан секрет TOKEN_SECRET');

    /* ---- меню для гостя ---- */
    if (path === '/v1/menu' && req.method === 'GET') {
      const slug = url.searchParams.get('c');
      if (!slugOk(slug)) return fail(400, 'неверный код заведения');

      const row = await env.DB.prepare('SELECT data FROM clients WHERE slug = ?').bind(slug).first();
      if (!row) return fail(404, 'заведение не найдено');

      return new Response(row.data, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          // полминуты кэша: цена в зале меняется редко, а нагрузка падает сильно
          'cache-control': 'public, max-age=30',
          ...CORS
        }
      });
    }

    /* ---- вход ---- */
    if (path === '/v1/login' && req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch (e) { return fail(400, e.message); }
      if (!slugOk(body.c)) return fail(400, 'неверный код заведения');

      const row = await env.DB.prepare('SELECT pass FROM clients WHERE slug = ?').bind(body.c).first();
      const ok = row ? await checkPassword(String(body.pass || ''), row.pass) : false;
      if (!ok) {
        // тормозим перебор: секунда на попытку делает подбор бессмысленным
        await new Promise((r) => setTimeout(r, 1000));
        return fail(401, 'неверный пароль');
      }
      return json({ token: await makeToken(secret, body.c), days: TOKEN_DAYS });
    }

    /* ---- сохранение меню ---- */
    if (path === '/v1/menu' && req.method === 'PUT') {
      const slug = url.searchParams.get('c');
      if (!slugOk(slug)) return fail(400, 'неверный код заведения');

      const tok = await readToken(secret, bearer(req));
      if (!tok || tok.c !== slug) return fail(401, 'нужен вход');

      let body;
      try { body = await readBody(req); } catch (e) { return fail(400, e.message); }
      const bad = validMenu(body);
      if (bad) return fail(400, bad);

      const res = await env.DB
        .prepare('UPDATE clients SET data = ?, updated = ? WHERE slug = ?')
        .bind(JSON.stringify(body), Date.now(), slug)
        .run();
      if (!res.meta.changes) return fail(404, 'заведение не найдено');

      return json({ ok: true, updated: Date.now() });
    }

    /* ---- смена пароля самим заведением ---- */
    if (path === '/v1/password' && req.method === 'POST') {
      let body;
      try { body = await readBody(req); } catch (e) { return fail(400, e.message); }
      if (!slugOk(body.c)) return fail(400, 'неверный код заведения');
      if (String(body.newPass || '').length < 6) return fail(400, 'новый пароль короче шести знаков');

      const row = await env.DB.prepare('SELECT pass FROM clients WHERE slug = ?').bind(body.c).first();
      if (!row || !(await checkPassword(String(body.pass || ''), row.pass))) {
        await new Promise((r) => setTimeout(r, 1000));
        return fail(401, 'неверный текущий пароль');
      }

      await env.DB.prepare('UPDATE clients SET pass = ? WHERE slug = ?')
        .bind(await hashPassword(body.newPass), body.c).run();
      return json({ ok: true, token: await makeToken(secret, body.c) });
    }

    /* ---- снимок блюда: отдаём гостю ----
       Имя содержит время загрузки, поэтому один и тот же адрес всегда
       означает одну и ту же картинку — кэшируем навсегда. Заменили фото
       у блюда — в меню появится новый адрес, старый просто перестанет
       запрашиваться. */
    if (path.startsWith('/v1/photo/') && req.method === 'GET') {
      const parts = path.slice('/v1/photo/'.length).split('/');
      if (parts.length !== 2 || !slugOk(parts[0]) || !/^[a-z0-9.-]{3,60}$/.test(parts[1])) {
        return fail(400, 'неверный адрес снимка');
      }
      const key = 'photo:' + parts[0] + ':' + parts[1];
      const obj = await env.PHOTOS.getWithMetadata(key, { type: 'arrayBuffer' });
      if (!obj || !obj.value) return fail(404, 'снимок не найден');

      return new Response(obj.value, {
        headers: {
          'content-type': (obj.metadata && obj.metadata.type) || 'image/webp',
          'cache-control': 'public, max-age=31536000, immutable',
          ...CORS
        }
      });
    }

    /* ---- снимок блюда: загрузка из админки ----
       Сжимает картинку сам браузер заведения, сюда приходит уже готовый
       небольшой файл. Верхнюю границу всё равно держим: телефон мог
       прислать что угодно, а бесплатный KV не резиновый. */
    if (path === '/v1/photo' && req.method === 'POST') {
      const slug = url.searchParams.get('c');
      if (!slugOk(slug)) return fail(400, 'неверный код заведения');

      const tok = await readToken(secret, bearer(req));
      if (!tok || tok.c !== slug) return fail(401, 'нужен вход');
      if (!env.PHOTOS) return fail(500, 'хранилище снимков не привязано');

      const type = (req.headers.get('content-type') || '').split(';')[0].trim();
      const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
      if (!EXT[type]) return fail(400, 'поддерживаются webp, jpeg и png');

      const body = await req.arrayBuffer();
      if (!body.byteLength) return fail(400, 'пустой файл');
      if (body.byteLength > MAX_PHOTO) return fail(413, 'снимок больше допустимого');

      const name = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + EXT[type];
      await env.PHOTOS.put('photo:' + slug + ':' + name, body, { metadata: { type } });

      return json({ ok: true, url: url.origin + '/v1/photo/' + slug + '/' + name, bytes: body.byteLength });
    }

    /* ---- завести заведение (только владелец воркера) ---- */
    if (path === '/v1/client' && req.method === 'POST') {
      if (!env.ADMIN_KEY) return fail(500, 'не задан секрет ADMIN_KEY');
      const given = req.headers.get('x-admin-key') || '';
      if (!sameBytes(enc.encode(given), enc.encode(env.ADMIN_KEY))) return fail(401, 'неверный ADMIN_KEY');

      let body;
      try { body = await readBody(req); } catch (e) { return fail(400, e.message); }
      if (!slugOk(body.slug)) return fail(400, 'slug: строчные латинские буквы, цифры и дефис');
      if (String(body.pass || '').length < 6) return fail(400, 'пароль короче шести знаков');

      const data = body.data || { v: 1, place: {}, promos: [], sections: [] };
      const bad = validMenu(data);
      if (bad) return fail(400, bad);

      await env.DB.prepare(
        `INSERT INTO clients (slug, data, pass, updated) VALUES (?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET pass = excluded.pass, updated = excluded.updated`
      ).bind(body.slug, JSON.stringify(data), await hashPassword(body.pass), Date.now()).run();

      return json({ ok: true, slug: body.slug });
    }

    return fail(404, 'нет такого адреса');
  }
};
