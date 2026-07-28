/*
    Рисует QR-код в SVG для печати на карте.

      node make-qr.js <ссылка> <куда-сохранить.svg>

    Уровень коррекции H: QR читается, даже если четверть кода
    закрыта логотипом, царапиной или бликом. Для карты, которая
    будет лежать на столе в кафе, это не роскошь.
*/

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const [, , url, out] = process.argv;

if (!url || !out) {
  console.error('Использование: node make-qr.js <ссылка> <файл.svg>');
  process.exit(1);
}

QRCode.toString(url, {
  type: 'svg',
  errorCorrectionLevel: 'H',
  margin: 0,            // поля добавляем сами в макете
  color: {
    dark: '#0E4735',    // фирменный хвойный
    light: '#0000'      // прозрачный фон
  }
})
  .then(svg => {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, svg, 'utf8');
    console.log(`  QR:        ${out}`);
  })
  .catch(err => {
    console.error('Не смог собрать QR:', err.message);
    process.exit(1);
  });
