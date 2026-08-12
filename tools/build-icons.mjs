#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const ICONS = resolve(ROOT, "docs/icons");

const SOURCES = [
  { src: "icon-192.png", dst: "apple-touch-icon-180.png", w: 180, h: 180 },
  { src: "icon-512.png", dst: "apple-touch-icon-167.png", w: 167, h: 167 },
  { src: "icon-512.png", dst: "apple-touch-icon-152.png", w: 152, h: 152 },
  { src: "icon-192.png", dst: "apple-touch-icon-120.png", w: 120, h: 120 },
];

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

function readPng(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error("not a PNG: " + path);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (bitDepth !== 8) throw new Error("only 8-bit depth supported");
  let bpp;
  if (colorType === 6) bpp = 4;
  else if (colorType === 2) bpp = 3;
  else throw new Error("unsupported color type: " + colorType);

  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString("ascii");
    if (type === "IDAT") chunks.push(buf.slice(off + 8, off + 8 + len));
    if (type === "IEND") break;
    off += 8 + len + 4;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const out = Buffer.alloc(stride);
    if (filter === 0) {
      line.copy(out);
    } else if (filter === 1) {
      for (let x = 0; x < stride; x++) {
        const left = x >= bpp ? out[x - bpp] : 0;
        out[x] = (line[x] + left) & 0xff;
      }
    } else if (filter === 2) {
      for (let x = 0; x < stride; x++) {
        out[x] = (line[x] + prev[x]) & 0xff;
      }
    } else if (filter === 3) {
      for (let x = 0; x < stride; x++) {
        const left = x >= bpp ? out[x - bpp] : 0;
        out[x] = (line[x] + ((left + prev[x]) >> 1)) & 0xff;
      }
    } else if (filter === 4) {
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? out[x - bpp] : 0;
        const b = prev[x];
        const c = x >= bpp ? prev[x - bpp] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        let pred;
        if (pa <= pb && pa <= pc) pred = a;
        else if (pb <= pc) pred = b;
        else pred = c;
        out[x] = (line[x] + pred) & 0xff;
      }
    } else {
      throw new Error("unknown filter: " + filter);
    }
    out.copy(pixels, y * stride);
    prev = out;
  }
  return { width, height, bpp, pixels };
}

function writePng(width, height, bpp, pixels) {
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const compressed = deflateSync(raw);
  const colorType = bpp === 4 ? 6 : 2;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = colorType;
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function resize(src, dstW, dstH) {
  const { width: srcW, height: srcH, bpp, pixels } = src;
  const dst = Buffer.alloc(dstW * dstH * bpp);
  for (let y = 0; y < dstH; y++) {
    const sy = ((y + 0.5) * srcH) / dstH - 0.5;
    const sy0 = Math.max(0, Math.floor(sy));
    const sy1 = Math.min(srcH - 1, sy0 + 1);
    const fy = Math.max(0, Math.min(1, sy - sy0));
    for (let x = 0; x < dstW; x++) {
      const sx = ((x + 0.5) * srcW) / dstW - 0.5;
      const sx0 = Math.max(0, Math.floor(sx));
      const sx1 = Math.min(srcW - 1, sx0 + 1);
      const fx = Math.max(0, Math.min(1, sx - sx0));
      for (let c = 0; c < bpp; c++) {
        const p00 = pixels[sy0 * srcW * bpp + sx0 * bpp + c];
        const p01 = pixels[sy0 * srcW * bpp + sx1 * bpp + c];
        const p10 = pixels[sy1 * srcW * bpp + sx0 * bpp + c];
        const p11 = pixels[sy1 * srcW * bpp + sx1 * bpp + c];
        const v =
          (1 - fx) * (1 - fy) * p00 +
          fx * (1 - fy) * p01 +
          (1 - fx) * fy * p10 +
          fx * fy * p11;
        dst[y * dstW * bpp + x * bpp + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
  }
  return { width: dstW, height: dstH, bpp, pixels: dst };
}

let total = 0;
let skipped = 0;
for (const { src, dst, w, h } of SOURCES) {
  const srcPath = resolve(ICONS, src);
  const dstPath = resolve(ICONS, dst);
  if (!existsSync(srcPath)) {
    console.warn(`skip ${dst}: source ${src} not found`);
    skipped++;
    continue;
  }
  const decoded = readPng(srcPath);
  const scaled = resize(decoded, w, h);
  const buf = writePng(scaled.width, scaled.height, scaled.bpp, scaled.pixels);
  writeFileSync(dstPath, buf);
  console.log(`✓ ${dst}  ${w}x${h}  ${buf.length} bytes`);
  total++;
}
console.log(`done: ${total} written, ${skipped} skipped`);
