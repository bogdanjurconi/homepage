// A colour the person picks themselves, turned into the same three tokens the preset accents set in
// base.css. Their choice is kept as it is, and only nudged when it would be unreadable: a colour must
// reach 3:1 against the page (the minimum for buttons and bold text), so pale yellow on a light page is
// darkened and navy on a dark page lightened; red, orange or green stay exactly as picked.

type Rgb = [number, number, number]

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
}
const rgbToHex = (c: Rgb) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((x, i) => x + (b[i] - x) * t) as Rgb

function luminance([r, g, b]: Rgb): number {
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const WHITE: Rgb = [255, 255, 255], BLACK: Rgb = [0, 0, 0], DARK_BG: Rgb = [15, 17, 21]

export const isCustomAccent = (accent: string) => /^#[0-9a-f]{6}$/i.test(accent)

const MIN_CONTRAST = 3

export function customAccentVars(hex: string, dark: boolean): Record<string, string> {
  const base = hexToRgb(hex)
  const page = dark ? DARK_BG : WHITE
  const toward = dark ? WHITE : BLACK
  let c = base
  for (let t = 0; t <= 1 && contrast(c, page) < MIN_CONTRAST; t += 0.05) c = mix(base, toward, t)
  // Text on accent buttons: white on the light theme (3:1 is guaranteed above); on the dark theme a deep
  // shade of the colour itself, like the presets, unless white reads better on it.
  const deep = mix(c, BLACK, 0.88)
  const fg = !dark || contrast(c, WHITE) > contrast(c, deep) ? '#fff' : rgbToHex(deep)
  return { '--accent': rgbToHex(c), '--accent-fg': fg, '--accent-soft': `rgb(${c.map(Math.round).join(' ')} / ${dark ? '.18' : '.13'})` }
}
