// Generates minimal PNG icons for the Chrome Extension
import { deflateSync } from "zlib";
import { writeFileSync } from "fs";

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function createIcon(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  // Draw a rounded-ish shield: blue bg, white "F" letter
  const raw = Buffer.allocUnsafe(size * (1 + size * 4));
  const cx = size / 2, cy = size / 2, r = size * 0.42;

  for (let y = 0; y < size; y++) {
    const base = y * (1 + size * 4);
    raw[base] = 0; // filter
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inCircle = dist <= r;
      const px = base + 1 + x * 4;
      if (inCircle) {
        raw[px] = 0x3b; raw[px + 1] = 0x82; raw[px + 2] = 0xf6; raw[px + 3] = 255; // blue
      } else {
        raw[px] = raw[px + 1] = raw[px + 2] = raw[px + 3] = 0; // transparent
      }
    }
  }

  // Draw a simple white "F" shape inside (only for size >= 16)
  if (size >= 16) {
    const s = size / 16;
    const drawPixel = (x, y) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const px = y * (1 + size * 4) + 1 + x * 4;
      raw[px] = raw[px + 1] = raw[px + 2] = 255; raw[px + 3] = 255;
    };
    // Vertical bar of F
    for (let i = 0; i < 8 * s; i++) drawPixel(cx - 1.5 * s, cy - 4 * s + i);
    // Top horizontal bar
    for (let i = 0; i < 5 * s; i++) drawPixel(cx - 1.5 * s + i, cy - 4 * s);
    // Middle bar
    for (let i = 0; i < 4 * s; i++) drawPixel(cx - 1.5 * s + i, cy - 1 * s);
  }

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

writeFileSync("public/icons/icon16.png", createIcon(16));
writeFileSync("public/icons/icon48.png", createIcon(48));
writeFileSync("public/icons/icon128.png", createIcon(128));
console.log("Icons created: 16×16, 48×48, 128×128");
