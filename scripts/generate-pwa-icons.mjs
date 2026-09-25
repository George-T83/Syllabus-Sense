import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, renderFn) {
  // RGBA buffer with filter byte per scanline
  const rowStride = width * 4 + 1;
  const rawData = Buffer.alloc(height * rowStride);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = renderFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT Chunk
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

// CRC32 table & calc
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

// Brand renderer: rounded rectangle gradient #8C6EFF -> #5B3DF5 -> #00BFA0
// (the same 3-stop diagonal gradient as Logo.tsx and icon.svg's mainGrad),
// with white ring and compass needle.
function lerpChannel(a, b, t) {
  return Math.round(a * (1 - t) + b * t);
}

/** 3-stop diagonal gradient matching mainGrad's 0%/55%/100% stops - a plain
 * 2-stop lerp between the first and last color (the previous bug here) never
 * reaches the teal endpoint at all. */
function gradientColor(t) {
  const stops = [
    [0, 0x8c, 0x6e, 0xff],
    [0.55, 0x5b, 0x3d, 0xf5],
    [1, 0x00, 0xbf, 0xa0],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i];
    const [t1, r1, g1, b1] = stops[i + 1];
    if (t <= t1) {
      const localT = (t - t0) / (t1 - t0);
      return [lerpChannel(r0, r1, localT), lerpChannel(g0, g1, localT), lerpChannel(b0, b1, localT)];
    }
  }
  return stops[stops.length - 1].slice(1);
}

function renderBrandIcon(x, y, w, h, isMaskable = false) {
  const u = x / w;
  const v = y / h;
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const t = (u + v) / 2;
  const [rGrad, gGrad, bGrad] = gradientColor(t);

  if (isMaskable) {
    // Full bleed background for maskable
    // Ring & star in center safe area (radius ~0.35 * w)
    return renderCenterGraphics(x, y, w, h, rGrad, gGrad, bGrad, 0.35);
  }

  // Rounded rectangle for standard icon
  const cornerRadius = w * 0.22;
  const inX = Math.abs(x - cx) <= (w / 2 - cornerRadius);
  const inY = Math.abs(y - cy) <= (h / 2 - cornerRadius);

  let insideCard = false;
  if (inX || inY) {
    insideCard = Math.abs(x - cx) <= w / 2 && Math.abs(y - cy) <= h / 2;
  } else {
    const cdx = Math.abs(x - cx) - (w / 2 - cornerRadius);
    const cdy = Math.abs(y - cy) - (h / 2 - cornerRadius);
    insideCard = (cdx * cdx + cdy * cdy) <= cornerRadius * cornerRadius;
  }

  if (!insideCard) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  return renderCenterGraphics(x, y, w, h, rGrad, gGrad, bGrad, 0.36);
}

function renderCenterGraphics(x, y, w, h, bgR, bgG, bgB, scaleFactor) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const rOuter = w * scaleFactor;
  const strokeW = Math.max(1.5, w * 0.05);

  // Outer white ring
  if (Math.abs(dist - rOuter) <= strokeW / 2) {
    return [255, 255, 255, 255];
  }

  // Compass needle: a single cardinal (N/S/E/W) diamond, not the old
  // 45°-rotated two-tone arrow - matches Logo.tsx's mark exactly, just
  // rendered as solid white (against this icon's colored plate) instead of
  // Logo.tsx's transparent-background gradient. Sized to ~0.56x the ring
  // radius so the tips sit well inside the ring instead of crowding it.
  const needleLen = rOuter * 0.56;
  const needleWidth = rOuter * 0.235;

  // Center circles
  if (dist <= rOuter * 0.18) {
    if (dist <= rOuter * 0.09) {
      return [0x5b, 0x3d, 0xf5, 255]; // center purple dot
    }
    return [255, 255, 255, 255]; // center white circle
  }

  if (Math.abs(dy) <= needleLen && Math.abs(dx) <= needleWidth * (1 - Math.abs(dy) / needleLen)) {
    return [255, 255, 255, 255];
  }

  return [bgR, bgG, bgB, 255];
}

const outDir = path.resolve('public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const icons = [
  { name: 'icon-16x16.png', size: 16, maskable: false },
  { name: 'icon-32x32.png', size: 32, maskable: false },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'icon-192x192.png', size: 192, maskable: false },
  { name: 'icon-512x512.png', size: 512, maskable: false },
  { name: 'icon-maskable-192x192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512x512.png', size: 512, maskable: true },
];

for (const icon of icons) {
  const pngBuf = createPNG(icon.size, icon.size, (x, y, w, h) => renderBrandIcon(x, y, w, h, icon.maskable));
  fs.writeFileSync(path.join(outDir, icon.name), pngBuf);
  console.log(`Generated ${icon.name} (${icon.size}x${icon.size})`);
}

// Also copy icon.svg to public/icons/icon.svg
const svgSrc = path.resolve('src/app/icon.svg');
if (fs.existsSync(svgSrc)) {
  fs.copyFileSync(svgSrc, path.join(outDir, 'icon.svg'));
  console.log('Copied icon.svg to public/icons/icon.svg');
}
