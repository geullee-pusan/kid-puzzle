// 홈 화면 아이콘을 만든다(외부 도구 없이 PNG를 직접 쓴다). 한 번 돌려서 public/에 넣어 둔다: node scripts/make-icons.mjs
// 그림: 짙은 청록 바탕에 동전 두 개. 금빛 동전(앞면)과 은빛 동전(뒷면)이 조금 겹쳐 있다.
// PNG를 쓰는 방식은 같은 아이를 위한 파이썬 학습 앱의 make-icons.mjs에서 가져왔다. 그림은 새로 그렸다.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(out, { recursive: true });

const BG = [11, 79, 92];

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}
const CRC = crcTable();
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// 그림은 가운데 60% 안에만 둔다(둥글게 잘리는 아이콘에서도 안 잘린다). 단위는 한 변을 100으로 본 값이다.
// 뒤에 그린 것이 위에 놓인다. 동전 하나는 테두리 원, 몸통 원, 안쪽 고리, 안쪽 원으로 이루어진다.
const coin = (cx, cy, r, rim, body, ring) => [
  { cx, cy, r, color: rim },
  { cx, cy, r: r - 2.2, color: body },
  { cx, cy, r: r - 6, color: ring },
  { cx, cy, r: r - 7.6, color: body },
];
const DISCS = [
  ...coin(60, 57, 19, [73, 80, 87], [222, 226, 230], [134, 142, 150]), // 은빛(뒷면)
  ...coin(41, 44, 19, [140, 100, 0], [252, 196, 25], [176, 137, 0]), // 금빛(앞면)
];

function draw(size) {
  const u = size / 100;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      let color = BG.slice();
      for (const disc of DISCS) {
        const d = Math.hypot(x + 0.5 - disc.cx * u, y + 0.5 - disc.cy * u);
        const a = Math.max(0, Math.min(1, disc.r * u - d + 0.5)); // 가장자리를 부드럽게
        if (a > 0) color = color.map((value, channel) => value + (disc.color[channel] - value) * a);
      }
      const at = row + 1 + x * 4;
      raw[at] = Math.round(color[0]);
      raw[at + 1] = Math.round(color[1]);
      raw[at + 2] = Math.round(color[2]);
      raw[at + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 비트 깊이
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(out, name), draw(size));
  console.log(`아이콘: ${name}`);
}
