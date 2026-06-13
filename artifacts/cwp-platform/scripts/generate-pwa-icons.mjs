import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public/pwa/icon-source.svg");
const outDir = path.join(root, "public/pwa");

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  await sharp(source).resize(size, size).png().toFile(path.join(outDir, name));
  console.log(`Generated ${name}`);
}

// Maskable icon: scale down to 80% safe zone centered on solid background
const maskableSize = 512;
const innerSize = Math.round(maskableSize * 0.8);
const offset = Math.round((maskableSize - innerSize) / 2);
const inner = await sharp(source).resize(innerSize, innerSize).png().toBuffer();
await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: { r: 0, g: 204, b: 204, alpha: 1 },
  },
})
  .composite([{ input: inner, top: offset, left: offset }])
  .png()
  .toFile(path.join(outDir, "maskable-icon-512.png"));
console.log("Generated maskable-icon-512.png");
