// アイコンPNGを依存なしで生成する(node tools/make-icons.mjs で再生成)。
// デザイン: 青地(#1E6FA8)に白の上昇折れ線+データ点(検査値の推移を表す)。
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [0x1e, 0x6f, 0xa8, 255];
const FG = [255, 255, 255, 255];

function makeIcon(size, { margin }) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG);

  // 上昇折れ線: 相対座標(0..1)の点列を太線で結ぶ
  const inner = size * (1 - margin * 2);
  const ox = size * margin;
  const oy = size * margin;
  const nodes = [
    [0.05, 0.75], [0.35, 0.55], [0.6, 0.68], [0.95, 0.2],
  ].map(([nx, ny]) => [ox + nx * inner, oy + ny * inner]);
  const thick = Math.max(2, Math.round(size * 0.045));
  const drawDot = (cx, cy, r) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(Math.round(x), Math.round(y), FG);
  };
  for (let i = 0; i < nodes.length - 1; i++) {
    const [x1, y1] = nodes[i];
    const [x2, y2] = nodes[i + 1];
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let s = 0; s <= steps; s++) {
      drawDot(x1 + ((x2 - x1) * s) / steps, y1 + ((y2 - y1) * s) / steps, thick);
    }
  }
  for (const [cx, cy] of nodes) drawDot(cx, cy, thick * 2);
  return encodePng(size, px);
}

fs.writeFileSync(path.join(outDir, 'icon-192.png'), makeIcon(192, { margin: 0.14 }));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makeIcon(512, { margin: 0.14 }));
// maskable: セーフゾーン(中央80%)に収まるよう余白を広めに
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), makeIcon(512, { margin: 0.22 }));
console.log('icons generated');
