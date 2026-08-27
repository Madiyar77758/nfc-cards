/* ============================================================
   Короткие адреса для карт: menyukz.com/<заведение>.

   Зачем: в NFC-метку и в QR попадает физический предмет на столе
   у клиента, удалённо его не поменять. Поэтому в карту пишется
   этот адрес, а куда он ведёт — правится здесь одной строкой.
   Переезд хостинга больше не требует объезжать кафе с телефоном.

   Добавить заведение — одна строка в PLACES и `npx wrangler deploy`.
   ============================================================ */

const PLACES = {
  xamidoo: 'https://madiyar77758.github.io/nfc-cards/xamidoo/',
  madiyar: 'https://madiyar77758.github.io/nfc-cards/madiyar/',
  dostar:  'https://madiyar77758.github.io/nfc-cards/dostar/'
};

// 302, а не 301: постоянный редирект браузеры кэшируют месяцами, и при
// следующем переезде часть гостей продолжала бы уходить на старый адрес.
const CODE = 302;

const PAGE = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>menyukz.com</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#FAF3F0; color:#2B1310; text-align:center;
         font:500 16px/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  p { margin:6px 0; }
  b { font-size:20px; }
  small { color:#7C5A53; }
</style>
<div>
  <p><b>menyukz.com</b></p>
  <p><small>Меню заведений по карте на столе</small></p>
</div>`;

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const slug = (parts[0] || '').toLowerCase();

    if (!slug) {
      return new Response(PAGE, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' }
      });
    }

    const target = PLACES[slug];
    if (!target) {
      return new Response('Такого заведения нет: ' + slug, {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }

    // Хвост пути переносим как есть: menyukz.com/xamidoo/menu/ ведёт
    // прямо в меню, а не на карточку. Пригодится для ссылок в соцсетях.
    const tail = parts.slice(1).join('/');
    const to = new URL(tail ? tail + (url.pathname.endsWith('/') ? '/' : '') : '', target);
    to.search = url.search;

    return Response.redirect(to.toString(), CODE);
  }
};
