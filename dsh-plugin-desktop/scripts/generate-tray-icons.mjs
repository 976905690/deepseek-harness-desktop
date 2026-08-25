/** Generate native tray bitmaps from the repository-owned Threerouter brand SVG. */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const buildRoot = join(packageRoot, 'build')
const sourcePath = join(buildRoot, 'tray-icon.svg')
const source = await readFile(sourcePath, 'utf8')

// The brand mark is a full-color illustration; nothing to validate on color here.
if (!/<svg/.test(source)) {
  throw new Error('generate-tray-icons: tray-icon.svg must be a valid SVG brand mark')
}

const variants = [
  ['tray-icon-blue.png', 16, false],
  ['tray-icon-blue@1.25x.png', 20, false],
  ['tray-icon-blue@1.5x.png', 24, false],
  ['tray-icon-blue@2x.png', 32, false],
  ['tray-iconTemplate.png', 16, true],
  ['tray-iconTemplate@2x.png', 32, true],
]

await Promise.all(variants.map(async ([filename, size, mono]) => {
  let pipeline = sharp(Buffer.from(source))
    .resize({ width: size, height: size, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
  if (mono) {
    pipeline = pipeline.greyscale()
  }
  await pipeline
    .png({ compressionLevel: 9 })
    .toFile(join(buildRoot, filename))
}))