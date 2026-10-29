// Renders the PWA icons in public/ from the SVG mark. Run: node scripts/icons.mjs
// The glyph is the one in public/icon.svg and in BrandIcon (src/components/Icons.tsx): keep the three in sync.
import sharp from 'sharp'
const accent = '#2f6bea'
const glyph = '<path d="M11 34.5V25.5L32 10.5 53 25.5V34.5" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 44h28M18 54h17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>'
// icon-*.png: the rounded square, as public/icon.svg
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${accent}"/>${glyph}</svg>`
// icon-maskable-*.png: full-bleed square, glyph scaled to the central 80% safe zone (Android crops it to a circle or a squircle)
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${accent}"/><g transform="translate(32 32) scale(.8) translate(-32 -32)">${glyph}</g></svg>`
for (const s of [192, 512]) {
  await sharp(Buffer.from(rounded), { density: 72 * s / 64 }).resize(s, s).png().toFile(`public/icon-${s}.png`)
  await sharp(Buffer.from(maskable), { density: 72 * s / 64 }).resize(s, s).png().toFile(`public/icon-maskable-${s}.png`)
}
console.log('icons written')
