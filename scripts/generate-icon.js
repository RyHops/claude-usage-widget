/**
 * Generate assets/icon.ico (multi-resolution) and assets/logo.png (256x256)
 * matching the app's title bar radial gauge design (purple arc at 50%).
 *
 * Run: node scripts/generate-icon.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// --- PNG helpers (mirrors main.js) ---
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// Radial gauge arc icon — same algorithm as main.js createGaugeIconPNG
function createGaugeIconPNG(size, utilization, r, g, b) {
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 0.5;
  const innerR = outerR - Math.max(2, size / 8);
  const progressAngle = (Math.min(utilization, 100) / 100) * 2 * Math.PI;
  const rowBytes = 1 + size * 4;
  const raw = Buffer.alloc(rowBytes * size);

  for (let y = 0; y < size; y++) {
    const off = y * rowBytes;
    raw[off] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = off + 1 + x * 4;

      if (dist < innerR - 0.5 || dist > outerR + 0.5) continue;

      let ringAlpha = 1;
      if (dist > outerR - 0.5) ringAlpha = Math.max(0, outerR + 0.5 - dist);
      else if (dist < innerR + 0.5) ringAlpha = Math.max(0, dist - (innerR - 0.5));

      let angle = Math.atan2(dx, -dy);
      if (angle < 0) angle += 2 * Math.PI;

      if (angle <= progressAngle) {
        const a = Math.round(240 * ringAlpha);
        raw[idx] = r; raw[idx + 1] = g; raw[idx + 2] = b; raw[idx + 3] = a;
      } else {
        const a = Math.round(80 * ringAlpha);
        raw[idx] = 100; raw[idx + 1] = 100; raw[idx + 2] = 110; raw[idx + 3] = a;
      }
    }
  }

  // Tip dot
  if (utilization > 0 && utilization < 100) {
    const midR = (innerR + outerR) / 2;
    const tipX = cx + midR * Math.sin(progressAngle);
    const tipY = cy - midR * Math.cos(progressAngle);
    const dotR = Math.max(1.2, size / 12);
    for (let y = Math.max(0, Math.floor(tipY - dotR - 1)); y <= Math.min(size - 1, Math.ceil(tipY + dotR + 1)); y++) {
      for (let x = Math.max(0, Math.floor(tipX - dotR - 1)); x <= Math.min(size - 1, Math.ceil(tipX + dotR + 1)); x++) {
        const d = Math.sqrt((x + 0.5 - tipX) ** 2 + (y + 0.5 - tipY) ** 2);
        if (d <= dotR + 0.5) {
          const idx = y * rowBytes + 1 + x * 4;
          const aa = d <= dotR - 0.5 ? 255 : Math.round(255 * (dotR + 0.5 - d));
          raw[idx] = r; raw[idx + 1] = g; raw[idx + 2] = b; raw[idx + 3] = Math.max(raw[idx + 3], aa);
        }
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

// --- Generate ---
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const R = 203, G = 166, B = 247; // #cba6f7 (Catppuccin Mauve)
const UTIL = 50; // 50% arc matches the title bar SVG

const pngBuffers = SIZES.map(s => createGaugeIconPNG(s, UTIL, R, G, B));

// Build ICO file (PNG-compressed entries)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);              // reserved
header.writeUInt16LE(1, 2);              // type = icon
header.writeUInt16LE(SIZES.length, 4);   // count

let dataOffset = 6 + SIZES.length * 16;
const entries = [];
for (let i = 0; i < SIZES.length; i++) {
  const entry = Buffer.alloc(16);
  entry[0] = SIZES[i] >= 256 ? 0 : SIZES[i];  // width (0 = 256)
  entry[1] = SIZES[i] >= 256 ? 0 : SIZES[i];  // height
  entry[2] = 0;                                  // color count
  entry[3] = 0;                                  // reserved
  entry.writeUInt16LE(1, 4);                     // planes
  entry.writeUInt16LE(32, 6);                    // bit count
  entry.writeUInt32LE(pngBuffers[i].length, 8);  // bytes in res
  entry.writeUInt32LE(dataOffset, 12);           // offset
  entries.push(entry);
  dataOffset += pngBuffers[i].length;
}

const ico = Buffer.concat([header, ...entries, ...pngBuffers]);
const assetsDir = path.join(__dirname, '..', 'assets');
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico);

// Also write 256x256 PNG as logo.png
fs.writeFileSync(path.join(assetsDir, 'logo.png'), pngBuffers[pngBuffers.length - 1]);

console.log('Generated:');
console.log('  assets/icon.ico  (' + SIZES.join(', ') + 'px) — ' + ico.length + ' bytes');
console.log('  assets/logo.png  (256x256) — ' + pngBuffers[pngBuffers.length - 1].length + ' bytes');
