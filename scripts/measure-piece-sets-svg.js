/**
 * Замеряет прозрачные поля картинок SVG-наборов (alpha, pixel, tatiana).
 *
 * SVG нельзя расположить в пиксельную сетку без браузера, поэтому замер идёт
 * в самом приложении: скрипт рисует картинку на canvas 512×512 и берёт
 * альфа-канал (alpha > 8).
 *
 * Как запустить:
 *   1) поднять dev-сервер: npm run dev
 *   2) открыть страницу с доской (например /local/classic)
 *   3) в DevTools → Console вставить этот скрипт и нажать Enter
 *   4) скопировать выведенный JSON в docs/piece-sets/measurements.raw.json
 *      ( рядом с данными PNG-наборов) и выполнить:
 *         python3 scripts/build-piece-set-measurements.py
 */
(async () => {
  const sets = ['alpha', 'pixel', 'tatiana'];
  const codes = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const out = {};

  for (const set of sets) {
    out[set] = {};
    for (const code of codes) {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `/pieces/${set}/${code}.svg`;
      });
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(image, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let minX = size;
      let minY = size;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (data[(y * size + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      out[set][code] =
        maxX < 0
          ? null
          : {
              artTop: +(minY / size).toFixed(4),
              artBottom: +((size - 1 - maxY) / size).toFixed(4),
              content: +((maxY - minY + 1) / size).toFixed(4),
              canvas: `${image.naturalWidth}x${image.naturalHeight}`,
            };
    }
  }

  console.log(JSON.stringify(out));
  return out;
})();
