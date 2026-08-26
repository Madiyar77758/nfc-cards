# Меню-API на Cloudflare Workers

Пока этот воркер не развёрнут, сайт работает — меню читается из файла
`<клиент>/data/menu.json`, а админка отдаёт правки на скачивание. Воркер нужен,
чтобы **заведение само меняло цены с телефона**, без вас и без git.

Бесплатного тарифа хватает с большим запасом: 100 000 запросов в день на воркер
и 5 ГБ в D1. Один воркер обслуживает **все** ваши заведения — новое добавляется
одной командой, деплой больше не нужен.

## Что понадобится

- аккаунт Cloudflare (бесплатный, регистрация по почте)
- Node.js на компьютере — он уже стоит

## Развёртывание, один раз

Все команды — из папки `api/`.

```bash
cd api

# 1. вход в аккаунт Cloudflare (откроется браузер)
npx wrangler login

# 2. создать базу — команда напечатает database_id
npx wrangler d1 create xd-menu
```

Скопируйте `database_id` из вывода в `wrangler.toml` вместо
`ВСТАВЬТЕ_ID_ИЗ_wrangler_d1_create`.

```bash
# 3. создать таблицу
npx wrangler d1 execute xd-menu --remote --file=./schema.sql

# 4. два секрета: подпись токенов и ваш ключ владельца.
#    Придумайте длинные случайные строки и сохраните их у себя.
npx wrangler secret put TOKEN_SECRET
npx wrangler secret put ADMIN_KEY

# 5. деплой
npx wrangler deploy
```

Последняя команда напечатает адрес вида
`https://xd-menu.ваш-логин.workers.dev` — это и есть API.

## Подключить заведение

**Шаг 1. Завести его в базе** — из папки репозитория, подставив свой адрес,
свой `ADMIN_KEY` и пароль, который отдадите администратору кафе:

```bash
curl -X POST "https://xd-menu.ваш-логин.workers.dev/v1/client" \
  -H "content-type: application/json" \
  -H "x-admin-key: ВАШ_ADMIN_KEY" \
  -d "{\"slug\":\"xamidoo\",\"pass\":\"пароль-для-кафе\",\"data\":$(cat ../xamidoo/data/menu.json)}"
```

В PowerShell:

```powershell
$menu = Get-Content ..\xamidoo\data\menu.json -Raw
$body = @{ slug = 'xamidoo'; pass = 'пароль-для-кафе'; data = ($menu | ConvertFrom-Json) } | ConvertTo-Json -Depth 12
Invoke-RestMethod -Method Post -Uri 'https://xd-menu.ваш-логин.workers.dev/v1/client' `
  -Headers @{ 'x-admin-key' = 'ВАШ_ADMIN_KEY' } -ContentType 'application/json; charset=utf-8' -Body $body
```

**Шаг 2. Указать адрес API сайту** — в `xamidoo/app/config.js`:

```js
window.XD_CONFIG = {
  API_BASE: 'https://xd-menu.ваш-логин.workers.dev',
  SLUG: 'xamidoo'
};
```

Закоммитьте и запушьте. С этого момента `/admin/` спрашивает пароль и сохраняет
по-настоящему, а меню у гостей обновляется в течение 30 секунд.

Повторный вызов `/v1/client` с тем же `slug` **меняет только пароль** — меню
не затирается. Так сбрасывают забытый пароль.

## Адреса

| Метод | Адрес | Кто может | Зачем |
|---|---|---|---|
| GET | `/v1/menu?c=slug` | любой | меню для гостя, кэш 30 с |
| POST | `/v1/login` | любой | `{c, pass}` → токен на 30 дней |
| PUT | `/v1/menu?c=slug` | по токену | сохранить меню |
| POST | `/v1/password` | по паролю | `{c, pass, newPass}` — кафе меняет пароль само |
| POST | `/v1/client` | по `x-admin-key` | завести заведение / сбросить пароль |
| GET | `/v1/health` | любой | проверить, что воркер жив |

## Резервная копия

```bash
npx wrangler d1 execute xd-menu --remote \
  --command "SELECT slug, updated FROM clients"
```

Меню можно в любой момент скачать кнопкой **«Файл»** в админке и положить в
`data/menu.json` — файл остаётся запасным вариантом, если воркер недоступен.

## Что осознанно не сделано

- **Загрузка фотографий.** Новые снимки блюд кладут файлами в
  `<клиент>/menu/photo/` (или вписывают в поле «Фото» полный адрес картинки).
  Загрузка прямо из админки потребует Cloudflare R2 — это отдельная настройка.
- **История правок.** В базе лежит только текущее меню. Регулярно жмите «Файл»
  и коммитьте `data/menu.json` — это и будет история.
- **Ограничение попыток входа.** Вместо счётчика неудачный вход отвечает через
  секунду: перебор пароля становится бессмысленным, лишнего состояния не нужно.
