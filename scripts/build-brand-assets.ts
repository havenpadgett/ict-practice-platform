// Regenerates the raster and vector brand files from the mark's geometry
// (src/lib/brand.ts): src/app/icon.svg, favicon.ico and apple-icon.png.
//   npm run brand
// The nav and the social/share images draw from the same geometry at render
// time, so this only covers files a browser fetches by name.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { markSvg } from "../src/lib/brand";

const app = path.resolve(__dirname, "../src/app");

async function png(size: number, opts: Parameters<typeof markSvg>[0] = {}): Promise<Buffer> {
  return sharp(Buffer.from(markSvg(opts)), { density: Math.max(72, (size / 32) * 72 * 2) })
    .resize(size, size)
    .png()
    .toBuffer();
}

/** An .ico holding PNG-encoded images (supported by every current browser). */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  fs.writeFileSync(path.join(app, "icon.svg"), markSvg() + "\n");
  const sizes = [16, 32, 48];
  fs.writeFileSync(path.join(app, "favicon.ico"), ico(await Promise.all(sizes.map(async (size) => ({ size, data: await png(size) })))));
  // iOS rounds the corners itself, so the tile is full-bleed square.
  const apple = await sharp(Buffer.from(markSvg({ tile: false })), { density: 600 })
    .resize(124, 124)
    .extend({ top: 28, bottom: 28, left: 28, right: 28, background: "#0d0e10" })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(app, "apple-icon.png"), apple);
  console.log("Wrote icon.svg, favicon.ico, apple-icon.png");
}

void main();
