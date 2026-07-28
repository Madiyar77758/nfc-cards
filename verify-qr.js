/*
    Проверяет, что QR действительно раскодируется в нужную ссылку.

      node verify-qr.js <ожидаемая-ссылка>

    Смысл простой: код уходит в печать тиражом. Ошибка в ссылке
    обнаружится только когда карты уже лежат на столах.
*/

const QRCode = require('qrcode');
const jsQR   = require('jsqr');
const { PNG } = require('pngjs');

const url = process.argv[2];

if (!url) {
  console.error('Использование: node verify-qr.js <ссылка>');
  process.exit(1);
}

QRCode.toBuffer(url, { errorCorrectionLevel: 'H', margin: 2, scale: 8, type: 'png' })
  .then(buf => {
    const png = PNG.sync.read(buf);
    const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

    if (!res) {
      console.log('НЕ ПРОЧИТАЛСЯ — код не распознан');
      process.exit(1);
    }
    if (res.data !== url) {
      console.log('НЕ СОВПАЛО');
      console.log('  ожидали: ' + url);
      console.log('  в коде:  ' + res.data);
      process.exit(1);
    }
    console.log('QR раскодирован обратно, ссылка совпадает:');
    console.log('  ' + res.data);
  })
  .catch(err => {
    console.error('Ошибка проверки:', err.message);
    process.exit(1);
  });
