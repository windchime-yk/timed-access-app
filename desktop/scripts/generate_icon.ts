// アプリアイコンを生成する。外部ツールに依存せず、角丸バッジ＋時計（時限アクセスの
// 象徴）を手続き的に描き、macOS用 icon.png と Windows用 icon.ico を同時に出力する。
// デザインを変えたいときはこのスクリプトを編集して `deno task --cwd desktop icon` を実行する。

type RGB = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 符号付き距離（境界より内側で負）を1px幅のカバレッジに変換する */
const coverage = (signedDistance: number) => clamp01(0.5 - signedDistance);

const sdRoundRect = (
  px: number,
  py: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  radius: number,
) => {
  const qx = Math.abs(px - cx) - (halfW - radius);
  const qy = Math.abs(py - cy) - (halfH - radius);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - radius;
};

const sdCircle = (px: number, py: number, cx: number, cy: number, r: number) =>
  Math.hypot(px - cx, py - cy) - r;

const sdSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));
  return Math.hypot(pax - bax * h, pay - bay * h);
};

/** 指定サイズでアイコンを描画し、RGBAバッファを返す */
const renderAt = (size: number): Uint8Array<ArrayBuffer> => {
  const buf = new Uint8Array(size * size * 4); // RGBA、初期値は透明
  const center = size / 2;
  const px = (ratio: number) => ratio * size;

  const blend = (x: number, y: number, [r, g, b]: RGB, a: number) => {
    if (a <= 0 || x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const da = buf[i + 3] / 255;
    const outA = a + da * (1 - a);
    if (outA <= 0) return;
    buf[i] = Math.round((r * a + buf[i] * da * (1 - a)) / outA);
    buf[i + 1] = Math.round((g * a + buf[i + 1] * da * (1 - a)) / outA);
    buf[i + 2] = Math.round((b * a + buf[i + 2] * da * (1 - a)) / outA);
    buf[i + 3] = Math.round(outA * 255);
  };

  const forEachPixel = (
    bounds: { x0: number; y0: number; x1: number; y1: number },
    draw: (x: number, y: number) => void,
  ) => {
    const x0 = Math.max(0, Math.floor(bounds.x0));
    const y0 = Math.max(0, Math.floor(bounds.y0));
    const x1 = Math.min(size, Math.ceil(bounds.x1));
    const y1 = Math.min(size, Math.ceil(bounds.y1));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) draw(x + 0.5, y + 0.5);
    }
  };

  // 1. 角丸バッジの背景（上から下への青のグラデーション）
  const margin = px(0.055);
  const half = center - margin;
  const bgTop: RGB = [59, 130, 246];
  const bgBottom: RGB = [37, 99, 235];
  forEachPixel({ x0: 0, y0: 0, x1: size, y1: size }, (x, y) => {
    const c = coverage(sdRoundRect(x, y, center, center, half, half, px(0.22)));
    if (c <= 0) return;
    const t = clamp01((y - margin) / (size - 2 * margin));
    blend(Math.floor(x), Math.floor(y), [
      Math.round(lerp(bgTop[0], bgBottom[0], t)),
      Math.round(lerp(bgTop[1], bgBottom[1], t)),
      Math.round(lerp(bgTop[2], bgBottom[2], t)),
    ], c);
  });

  // 2. 時計の白い文字盤
  const faceR = px(0.3);
  const clockBox = {
    x0: center - faceR - 4,
    y0: center - faceR - 4,
    x1: center + faceR + 4,
    y1: center + faceR + 4,
  };
  forEachPixel(clockBox, (x, y) => {
    const c = coverage(sdCircle(x, y, center, center, faceR));
    if (c > 0) blend(Math.floor(x), Math.floor(y), [255, 255, 255], c);
  });

  // 3. 目盛り（12本）
  const tick: RGB = [96, 165, 250];
  const tickInner = px(0.24);
  const tickOuter = px(0.275);
  const tickWidth = px(0.011);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const ax = center + dx * tickInner;
    const ay = center + dy * tickInner;
    const bx = center + dx * tickOuter;
    const by = center + dy * tickOuter;
    forEachPixel(clockBox, (x, y) => {
      const c = coverage(sdSegment(x, y, ax, ay, bx, by) - tickWidth);
      if (c > 0) blend(Math.floor(x), Math.floor(y), tick, c);
    });
  }

  // 4. 時針・分針（10:10 のバランスのよい配置）
  const hand: RGB = [30, 58, 138];
  const drawHand = (angleDeg: number, length: number, width: number) => {
    const a = (angleDeg * Math.PI) / 180;
    const ex = center + Math.sin(a) * length;
    const ey = center - Math.cos(a) * length;
    forEachPixel(clockBox, (x, y) => {
      const c = coverage(sdSegment(x, y, center, center, ex, ey) - width);
      if (c > 0) blend(Math.floor(x), Math.floor(y), hand, c);
    });
  };
  drawHand(305, px(0.14), px(0.013)); // 時針
  drawHand(60, px(0.2), px(0.01)); // 分針

  // 5. 中心のハブ
  const hub: RGB = [37, 99, 235];
  forEachPixel(clockBox, (x, y) => {
    const c = coverage(sdCircle(x, y, center, center, px(0.022)));
    if (c > 0) blend(Math.floor(x), Math.floor(y), hub, c);
  });

  return buf;
};

/** 高解像度で描いて縮小（スーパーサンプリング）し、小サイズでも滑らかにする */
const downsample = (
  src: Uint8Array,
  size: number,
  ss: number,
): Uint8Array<ArrayBuffer> => {
  const big = size * ss;
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sr = 0, sg = 0, sb = 0, sa = 0;
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const i = ((y * ss + dy) * big + (x * ss + dx)) * 4;
          const a = src[i + 3] / 255;
          // 透明境界の色にじみを防ぐため乗算済みアルファで平均する
          sr += src[i] * a;
          sg += src[i + 1] * a;
          sb += src[i + 2] * a;
          sa += a;
        }
      }
      const o = (y * size + x) * 4;
      if (sa > 0) {
        out[o] = Math.round(sr / sa);
        out[o + 1] = Math.round(sg / sa);
        out[o + 2] = Math.round(sb / sa);
      }
      out[o + 3] = Math.round((sa / (ss * ss)) * 255);
    }
  }
  return out;
};

/** 目標サイズのアイコンを、必要に応じてスーパーサンプリングして描く */
const renderIcon = (size: number): Uint8Array<ArrayBuffer> => {
  // 内部解像度を256px以上に保ち、どのサイズでも十分にアンチエイリアスする
  const ss = Math.max(1, Math.ceil(256 / size));
  return ss === 1 ? renderAt(size) : downsample(renderAt(size * ss), size, ss);
};

// --- PNGエンコード（依存なし。DEFLATEはCompressionStream、CRC32は自前） ---

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Uint8Array) => {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(4 + body.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(4 + body.length, crc32(body));
  return out;
};

const deflate = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> => {
  const cs = new CompressionStream("deflate"); // zlib(RFC1950)形式でPNGのIDATに適合
  const stream = new Blob([data]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const encodePng = async (
  size: number,
  rgba: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> => {
  // フィルタバイト0を各スキャンライン先頭に付けた生データ
  const raw = new Uint8Array((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    raw.set(
      rgba.subarray(y * size * 4, (y + 1) * size * 4),
      y * (size * 4 + 1) + 1,
    );
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, size);
  ihdrView.setUint32(4, size);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // カラータイプ: RGBA

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = await deflate(raw);
  const parts = [
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    png.set(p, offset);
    offset += p.length;
  }
  return png;
};

// --- ICOエンコード（各サイズのPNGを内包する。Vista以降が対応） ---

const encodeIco = (
  images: { size: number; png: Uint8Array }[],
): Uint8Array<ArrayBuffer> => {
  const headerSize = 6 + images.length * 16;
  const totalSize = images.reduce((n, img) => n + img.png.length, headerSize);
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // 予約
  view.setUint16(2, 1, true); // タイプ: アイコン
  view.setUint16(4, images.length, true); // 画像数

  let dataOffset = headerSize;
  images.forEach((img, index) => {
    const e = 6 + index * 16;
    out[e] = img.size >= 256 ? 0 : img.size; // 幅（256は0で表す）
    out[e + 1] = img.size >= 256 ? 0 : img.size; // 高さ
    out[e + 2] = 0; // パレット色数
    out[e + 3] = 0; // 予約
    view.setUint16(e + 4, 1, true); // カラープレーン数
    view.setUint16(e + 6, 32, true); // ビット深度
    view.setUint32(e + 8, img.png.length, true); // データ長
    view.setUint32(e + 12, dataOffset, true); // データ位置
    out.set(img.png, dataOffset);
    dataOffset += img.png.length;
  });
  return out;
};

// --- 出力 ---

const pngPath = new URL("../icon.png", import.meta.url);
const icoPath = new URL("../icon.ico", import.meta.url);

// macOS用: 1024pxの単一PNG
const mainPng = await encodePng(1024, renderIcon(1024));
await Deno.writeFile(pngPath, mainPng);
console.log(`Wrote ${pngPath.pathname} (1024x1024, ${mainPng.length} bytes)`);

// Windows用: 複数サイズを内包した.ico
const icoSizes = [16, 32, 48, 64, 128, 256];
const icoImages = await Promise.all(
  icoSizes.map(async (size) => ({
    size,
    png: await encodePng(size, renderIcon(size)),
  })),
);
const ico = encodeIco(icoImages);
await Deno.writeFile(icoPath, ico);
console.log(
  `Wrote ${icoPath.pathname} (${icoSizes.join("/")}px, ${ico.length} bytes)`,
);
