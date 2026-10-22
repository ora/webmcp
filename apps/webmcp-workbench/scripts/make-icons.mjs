// Generates the extension icons (public/icons/icon-{16,48,128}.png) with no
// image dependencies: a rounded indigo tile with a white ">_" workbench mark.
// Run via `npm run icons`; output PNGs are committed.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Build a PNG from a per-pixel RGBA function. */
function png(size, rgbaAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = rgbaAt(x, y);
      raw.set([r, g, b, a], row + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Distance from point p to segment ab, in pixels. */
function segDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)),
  );
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

function iconPixel(size) {
  const s = size;
  const radius = s * 0.2;
  const stroke = s * 0.09;
  return (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    // Rounded-rect alpha
    const cx = Math.max(radius, Math.min(s - radius, px));
    const cy = Math.max(radius, Math.min(s - radius, py));
    const cornerDist = Math.hypot(px - cx, py - cy);
    const alpha = Math.max(0, Math.min(1, radius - cornerDist + 1));
    if (alpha === 0) return [0, 0, 0, 0];
    // Background: indigo, slightly lighter toward the top-left
    const t = (x + y) / (2 * s);
    const bg = [
      Math.round(0x4f - 0x14 * t),
      Math.round(0x63 - 0x18 * t),
      Math.round(0xf5 - 0x28 * t),
    ];
    // Foreground mark: ">" chevron + "_" underscore
    const chev = Math.min(
      segDist(px, py, s * 0.24, s * 0.32, s * 0.46, s * 0.5),
      segDist(px, py, s * 0.46, s * 0.5, s * 0.24, s * 0.68),
    );
    const under = segDist(px, py, s * 0.56, s * 0.66, s * 0.78, s * 0.66);
    const d = Math.min(chev, under);
    const ink = Math.max(0, Math.min(1, stroke / 2 - d + 1));
    const mix = (bgc) => Math.round(bgc + (255 - bgc) * ink);
    return [mix(bg[0]), mix(bg[1]), mix(bg[2]), Math.round(alpha * 255)];
  };
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon-${size}.png`), png(size, iconPixel(size)));
  console.log(`icon-${size}.png`);
}
