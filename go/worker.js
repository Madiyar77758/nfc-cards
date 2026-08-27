/* ============================================================
   menyukz.com — собственный адрес карт заведений.

   Это не перенаправление, а прокси: воркер сам забирает страницу
   с хостинга и отдаёт её от имени домена. Поэтому в адресной строке
   у гостя остаётся menyukz.com/xamidoo, а не адрес GitHub.

   Зачем вообще: метка и QR — физический предмет на столе у клиента,
   удалённо его не поменять. В карту пишется этот адрес, а где реально
   лежат страницы — правится здесь одной строкой.

   Добавить заведение: строка в PLACES и `npx wrangler deploy` из go/.
   ============================================================ */

const HOST = 'https://madiyar77758.github.io/nfc-cards';

const PLACES = {
  xamidoo: HOST + '/xamidoo',
  madiyar: HOST + '/madiyar',
  dostar:  HOST + '/dostar'
};

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

const html = (body, status) => new Response(body, {
  status: status || 200,
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' }
});

export default {
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Только GET', { status: 405 });
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const slug = (parts[0] || '').toLowerCase();

    if (!slug) return html(PAGE);

    const base = PLACES[slug];
    if (!base) {
      return new Response('Такого заведения нет: ' + slug, {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }

    // Без завершающей косой относительные ссылки на странице (app/brand.css,
    // menu/, img/…) считались бы от корня домена и вели в никуда.
    if (parts.length === 1 && !url.pathname.endsWith('/')) {
      return Response.redirect(url.origin + '/' + slug + '/' + url.search, 301);
    }

    const tail = parts.slice(1).join('/');
    const target = base + '/' + tail + (tail && url.pathname.endsWith('/') ? '/' : '') + url.search;

    const upstream = await fetch(target, {
      method: req.method,
      headers: { 'accept': req.headers.get('accept') || '*/*',
                 'accept-encoding': req.headers.get('accept-encoding') || '' },
      // Тело статики одинаково для всех гостей — держим его на краю сети,
      // иначе каждый снимок блюда ездил бы до GitHub заново.
      cf: { cacheEverything: true, cacheTtl: 300 }
    });

    // Заголовки исходного ответа переносим, но управление кэшем ставим своё:
    // GitHub отдаёт короткий срок, а меню меняется через воркер API, не здесь.
    const out = new Headers(upstream.headers);
    out.delete('content-security-policy');
    out.set('cache-control', 'public, max-age=300');

    return new Response(upstream.body, { status: upstream.status, headers: out });
  }
};
