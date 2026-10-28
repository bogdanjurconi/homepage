// Renders the PWA icons in public/ from the SVG mark. Run: node scripts/icons.mjs
import sharp from 'sharp'
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2563eb"/><g transform="translate(32 32) scale(${1 - pad}) translate(-32 -32)"><path d="M32 14 12 31h6v17h12V37h4v11h12V31h6z" fill="#fff"/></g></svg>`
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2563eb"/><path d="M32 14 12 31h6v17h12V37h4v11h12V31h6z" fill="#fff"/></svg>`
for (const s of [192, 512]) {
  await sharp(Buffer.from(rounded), { density: 72 * s / 64 }).resize(s, s).png().toFile(`public/icon-${s}.png`)
  await sharp(Buffer.from(svg(0.2)), { density: 72 * s / 64 }).resize(s, s).png().toFile(`public/icon-maskable-${s}.png`)
}
console.log('icons written')
