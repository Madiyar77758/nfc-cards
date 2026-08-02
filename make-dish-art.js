/*
    Рисует квадратные иллюстрации блюд в SVG.

      node make-dish-art.js <slug>

    Почему вектор, а не фотографии: файл весит около двух килобайт вместо
    пятидесяти, не мылится ни на каком экране и всегда изображает то самое
    блюдо. Для настоящего клиента сюда кладутся снимки его собственной еды.
*/

const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) { console.error('Использование: node make-dish-art.js <slug>'); process.exit(1); }

const out = path.join(__dirname, slug, 'menu', 'photo');
fs.mkdirSync(out, { recursive: true });

/* ---------- общие детали ---------- */

const P = {                       // палитра
  cream:'#F4F1EA', rim:'#2C6E8F', rice:'#E6D2A6', meat:'#7E4A2A', meatL:'#8A5330',
  carrot:'#D0873A', dough:'#EDE2C8', doughL:'#F3EBD8', broth:'#C98B3E', brothL:'#E5B463',
  green:'#4F8442', tomato:'#C4463A', tomatoL:'#E0705E', onion:'#F1E8EE',
  crust:'#D3A159', crustD:'#B8823C', bread:'#D9AC63', breadIn:'#C8944B',
  tea:'#B5722A', milk:'#D9BC94', honey:'#D9A227', nut:'#B08A5A', apricot:'#E0913C',
  pickle:'#8FA85A', noodle:'#EFE2BE'
};

// круглая тарелка с синим ободком
const plate = (r = 34) => `
  <circle cx="36" cy="36" r="${r}" fill="${P.cream}"/>
  <circle cx="36" cy="36" r="${r - 4}" fill="none" stroke="${P.rim}" stroke-width="1.2" opacity=".5"/>`;

const dot = (x, y, r, f, o = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" opacity="${o}"/>`;
const ell = (x, y, rx, ry, f, rot = 0) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" transform="rotate(${rot} ${x} ${y})"/>`;
const bar = (x, y, w, h, f, rot = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="${f}" transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"/>`;

/* ---------- блюда ---------- */

const dishes = {
  plov: plate() + `<circle cx="36" cy="36" r="26" fill="${P.rice}"/>` +
    bar(21,23,3.4,12,P.carrot,-26) + bar(45,27,3.4,12,P.carrot,36) +
    bar(29,45,3.4,11,P.carrot,-64) + bar(38,17,3.4,10,P.carrot,14) +
    bar(17,38,3.4,11,P.carrot,72) +
    ell(28,36,6.5,5.4,P.meat,-16) + ell(45,46,5.6,4.7,P.meat,28) +
    dot(47,24,6,'#F0E7D4') + `<path d="M47 18.5v11M41.5 24h11" stroke="#D8CAB0" stroke-width="1"/>`,

  beshbarmak: plate() +
    `<g fill="${P.dough}" stroke="#DBCCAB" stroke-width=".8">
       <path d="M13 34l12-7 12 7-12 7z"/><path d="M34 29l12-7 12 7-12 7z"/><path d="M22 47l12-7 12 7-12 7z"/></g>` +
    ell(30,33,7,4.6,P.meatL,-14) + ell(46,42,6,4,P.meatL,18) +
    `<g fill="none" stroke="${P.onion}" stroke-width="1.8"><ellipse cx="24" cy="43" rx="5" ry="2.6"/><ellipse cx="51" cy="31" rx="4.4" ry="2.3"/></g>` +
    ell(38,50,3,1.5,P.green),

  lagman: plate() + `<circle cx="36" cy="36" r="26" fill="${P.broth}" opacity=".55"/>` +
    `<g fill="none" stroke="${P.noodle}" stroke-width="2.6" stroke-linecap="round">
       <path d="M18 30c8 6 20 2 26 8"/><path d="M16 38c10 4 22-2 30 4"/>
       <path d="M20 46c8 2 18-4 26 0"/></g>` +
    ell(30,32,5.5,3.6,P.meatL,-18) + ell(46,40,5,3.4,P.meatL,22) +
    bar(40,20,3,9,P.green,30) + bar(22,50,3,8,P.tomato,-40),

  kuyrdak: plate() + `<circle cx="36" cy="36" r="26" fill="${P.broth}" opacity=".35"/>` +
    ell(28,32,6.5,5,P.meat,-14) + ell(44,34,6,4.6,P.meat,20) + ell(34,47,6,4.6,P.meat,-6) +
    `<g fill="#E8C98C"><rect x="42" y="44" width="9" height="7" rx="2" transform="rotate(18 46 47)"/>
       <rect x="20" y="41" width="8" height="6.5" rx="2" transform="rotate(-24 24 44)"/></g>` +
    ell(36,22,4,2,P.onion) + ell(52,26,3.4,1.8,P.green,30),

  manty: plate() +
    `<g fill="${P.doughL}" stroke="#DDD2B8" stroke-width="1">
       <path d="M25 26c0-4 4-6 7-6s7 2 7 6-3 8-7 8-7-4-7-8z"/>
       <path d="M42 34c0-4 4-6 7-6s7 2 7 6-3 8-7 8-7-4-7-8z"/>
       <path d="M18 44c0-4 4-6 7-6s7 2 7 6-3 8-7 8-7-4-7-8z"/>
       <path d="M35 48c0-4 4-6 7-6s7 2 7 6-3 8-7 8-7-4-7-8z"/></g>` +
    `<g fill="none" stroke="#CFC2A6" stroke-width=".9">
       <path d="M32 21v6M49 29v6M25 39v6M42 43v6"/></g>`,

  shashlik: plate() +
    `<g stroke="#9A9DA0" stroke-width="1.6" stroke-linecap="round">
       <path d="M12 26h48"/><path d="M12 40h48"/><path d="M12 54h48"/></g>` +
    ell(24,26,6,4.4,P.meat) + ell(38,26,6,4.4,P.meat) + ell(52,26,5,4,P.meat) +
    ell(24,40,6,4.4,P.meat) + ell(38,40,6,4.4,P.meat) + ell(52,40,5,4,P.meat) +
    ell(24,54,6,4.4,P.meat) + ell(38,54,6,4.4,P.meat) + ell(52,54,5,4,P.meat),

  'shashlik-ch': plate() +
    `<g stroke="#9A9DA0" stroke-width="1.6" stroke-linecap="round">
       <path d="M12 28h48"/><path d="M12 44h48"/></g>` +
    ell(24,28,6,4.4,'#D9A860') + ell(38,28,6,4.4,'#D9A860') + ell(52,28,5,4,'#D9A860') +
    ell(24,44,6,4.4,'#D9A860') + ell(38,44,6,4.4,'#D9A860') + ell(52,44,5,4,'#D9A860') +
    ell(36,58,4,2,P.onion),

  sorpa: plate() + `<circle cx="36" cy="36" r="26" fill="${P.broth}"/>` +
    dot(27,29,3.4,P.brothL,.85) + dot(44,43,2.7,P.brothL,.85) + dot(33,47,2,P.brothL,.85) +
    dot(47,28,2.2,P.brothL,.85) + dot(21,39,1.8,P.brothL,.85) +
    ell(36,33,8.5,6.8,P.meatL,-8) +
    ell(25,43,3.4,1.8,P.green,-22) + ell(48,37,3.4,1.8,P.green,34) + ell(38,50,3,1.6,P.green),

  shurpa: plate() + `<circle cx="36" cy="36" r="26" fill="${P.broth}" opacity=".9"/>` +
    bar(26,26,4,10,P.carrot,-30) + bar(44,30,4,9,P.carrot,40) +
    `<g fill="#E8C98C"><rect x="30" y="42" width="9" height="7" rx="2" transform="rotate(12 34 45)"/></g>` +
    ell(44,45,5.5,4,P.meatL,20) + ell(24,44,3,3,P.tomato) +
    ell(38,22,3.4,1.8,P.green,10),

  kespe: plate() + `<circle cx="36" cy="36" r="26" fill="${P.broth}" opacity=".7"/>` +
    `<g fill="none" stroke="${P.noodle}" stroke-width="2.2" stroke-linecap="round">
       <path d="M17 32c10 4 24-2 34 4"/><path d="M17 40c10 4 24-2 34 4"/>
       <path d="M20 47c9 3 20-2 28 2"/></g>` +
    ell(32,28,5,3.4,P.meatL,-12) + ell(46,50,3,1.6,P.green,20),

  achichuk: plate() +
    dot(29,31,8.4,P.tomato) + dot(29,31,5,P.tomatoL) +
    dot(45,38,7.8,P.tomato) + dot(45,38,4.6,P.tomatoL) +
    dot(34,48,7.2,P.tomato) + dot(34,48,4.3,P.tomatoL) +
    `<g fill="none" stroke="${P.onion}" stroke-width="2.2"><circle cx="46" cy="24" r="6"/><circle cx="22" cy="42" r="5.2"/></g>` +
    bar(35,18,3.2,9,P.green,28) + bar(50,47,3.2,8.5,P.green,-42),

  salat: plate() +
    ell(30,30,7,4.6,P.meatL,-16) + ell(44,42,6.4,4.2,P.meatL,22) +
    `<g fill="none" stroke="${P.onion}" stroke-width="2"><circle cx="45" cy="26" r="5.4"/></g>` +
    bar(22,36,3.2,10,P.green,-14) + bar(36,48,3.2,9,P.green,40) +
    dot(52,34,2.2,'#B3243B') + dot(48,48,2.2,'#B3243B') + dot(26,48,2,'#B3243B') + dot(24,26,2,'#B3243B'),

  solenya: plate() +
    dot(27,30,7,P.tomato) + dot(27,30,4.2,P.tomatoL) +
    `<g fill="${P.pickle}"><rect x="40" y="24" width="7" height="16" rx="3.5" transform="rotate(24 43 32)"/>
       <rect x="46" y="38" width="6.5" height="14" rx="3.2" transform="rotate(-18 49 45)"/></g>` +
    `<g fill="#EDE6CE"><path d="M20 44c4-4 12-4 16 0-2 6-14 6-16 0z"/></g>` +
    bar(33,46,3,9,P.green,64),

  morkov: plate() +
    `<g fill="${P.carrot}">` +
    [[24,28,-20],[32,25,15],[40,29,-35],[28,36,40],[38,38,-10],[46,34,25],
     [26,45,-30],[36,47,20],[44,44,-15],[32,53,35]]
      .map(([x,y,r]) => `<rect x="${x}" y="${y}" width="2.8" height="13" rx="1.4" transform="rotate(${r} ${x+1.4} ${y+6.5})"/>`).join('') +
    `</g>` + dot(48,50,1.6,'#5C4326',.7) + dot(22,38,1.6,'#5C4326',.7),

  samsa: plate() +
    `<g fill="${P.crust}" stroke="${P.crust}" stroke-width="4.5" stroke-linejoin="round">
       <path d="M27 22 36 37 18 37Z"/><path d="M50 27 57 40 43 40Z"/><path d="M39 45 47 58 31 58Z"/></g>` +
    `<g fill="none" stroke="${P.crustD}" stroke-width="1.1" opacity=".8"><path d="M27 24v11M50 29v9M39 47v9"/></g>` +
    `<g fill="#F3E7CE">${dot(24,30,1.2,'#F3E7CE')}${dot(30,32,1.2,'#F3E7CE')}${dot(48,34,1.1,'#F3E7CE')}${dot(36,52,1.2,'#F3E7CE')}</g>`,

  lepeshka: `<circle cx="36" cy="36" r="34" fill="${P.bread}"/>
    <circle cx="36" cy="36" r="34" fill="none" stroke="#BE8C45" stroke-width="1.3"/>
    <circle cx="36" cy="36" r="22" fill="${P.breadIn}"/>
    <circle cx="36" cy="36" r="22" fill="none" stroke="#B07F3B" stroke-width="1.1"/>
    <g fill="#A9762F" opacity=".8">${dot(36,36,2.6,'#A9762F')}${dot(28,29,1.9,'#A9762F')}${dot(44,29,1.9,'#A9762F')}${dot(28,43,1.9,'#A9762F')}${dot(44,43,1.9,'#A9762F')}${dot(36,24,1.7,'#A9762F')}${dot(24,36,1.7,'#A9762F')}${dot(48,36,1.7,'#A9762F')}${dot(36,48,1.7,'#A9762F')}</g>
    <g fill="#F0E4CE" opacity=".7">${dot(18,20,1.4,'#F0E4CE')}${dot(55,22,1.4,'#F0E4CE')}${dot(16,52,1.4,'#F0E4CE')}</g>`,

  tokash: plate() +
    `<g fill="${P.crust}"><ellipse cx="28" cy="30" rx="11" ry="9"/><ellipse cx="46" cy="38" rx="10" ry="8.4"/><ellipse cx="33" cy="49" rx="10" ry="8.4"/></g>` +
    `<g fill="none" stroke="${P.crustD}" stroke-width="1" opacity=".7">
       <path d="M22 28c4-3 10-3 13 0M40 36c4-3 10-3 13 0M27 47c4-3 10-3 13 0"/></g>`,

  chakchak: plate() + `<circle cx="36" cy="36" r="24" fill="#EBCB84" opacity=".4"/>` +
    [[24,26,24],[33,22,-38],[41,27,62],[26,38,-18],[35,36,48],[20,33,74],
     [44,40,-28],[30,46,34],[40,48,-12]]
      .map(([x,y,r]) => `<rect x="${x}" y="${y}" width="3.2" height="10" rx="1.6" fill="${P.honey}" transform="rotate(${r} ${x+1.6} ${y+5})"/>`).join('') +
    dot(50,30,1.6,'#F6E9C8',.8) + dot(28,54,1.6,'#F6E9C8',.8),

  med: plate() + `<circle cx="36" cy="36" r="24" fill="#EBCB84" opacity=".55"/>` +
    ell(30,32,8,6.8,P.nut) + `<path d="M30 25.5v13M22.5 32h15" stroke="#8E6C42" stroke-width="1.1"/>` +
    ell(46,45,7.4,6.2,P.nut) + `<path d="M46 39v12M39 45h14" stroke="#8E6C42" stroke-width="1.1"/>` +
    dot(48,26,3.4,P.honey) + dot(24,48,3,P.honey),

  kuraga: plate() +
    ell(28,30,7.4,6,P.apricot) + ell(44,34,6.8,5.6,P.apricot) +
    ell(34,46,7,5.8,'#C97B2E') + ell(48,48,6,5,'#C97B2E') +
    `<g fill="none" stroke="#A65F1E" stroke-width="1" opacity=".7">
       <path d="M24 28c3 2 6 2 9 0M40 32c3 2 6 2 9 0M30 44c3 2 6 2 9 0"/></g>`
};

/* ---------- запись ---------- */

let n = 0;
for (const [name, body] of Object.entries(dishes)) {
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="520" height="520">
  <rect width="72" height="72" fill="#EFF4F0"/>
  <g>${body}</g>
</svg>`;
  fs.writeFileSync(path.join(out, name + '.svg'), svg, 'utf8');
  n++;
}

console.log(`нарисовано: ${n} шт., папка ${out}`);
