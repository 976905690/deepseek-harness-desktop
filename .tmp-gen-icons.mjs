/** One-time generator: produce build/app-icon.png from the Threerouter brand mark. */
import { copyFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve('dsh-plugin-desktop/build')
const mark = 'D:/Users/lfh/source/repos/threerouter/threerouter-sub2api/frontend/public/logo.svg'
const icc = 'C:/Windows/System32/spool/drivers/color/sRGB Color Space Profile.icm'

// Brand source lives inside the desktop build dir so the generate scripts stay self-contained.
await copyFile(mark, resolve(root, 'threerouter-mark.svg'))

const rendered = await sharp(resolve(root, 'threerouter-mark.svg'), { failOn: 'warning' })
  .resize({ width: 1024, height: 1024, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .toColourspace('rgb16')
  .withIccProfile(icc, 'srgb')
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer()

const meta = await sharp(rendered).metadata()
console.log('app-icon meta:', {
  format: meta.format, width: meta.width, height: meta.height, space: meta.space,
  depth: meta.depth, bitsPerSample: meta.bitsPerSample, channels: meta.channels,
  hasAlpha: meta.hasAlpha, icc: meta.icc !== undefined,
})

await writeFile(resolve(root, 'app-icon.png'), rendered)