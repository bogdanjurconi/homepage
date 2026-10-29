// Screenshots of every page at phone / tablet / desktop widths, light and dark.
// Usage: SHOT_EMAIL=... SHOT_PASSWORD=... node scripts/screenshots.mjs [baseUrl] [outDir]
// Needs a running server (npm run preview → http://localhost:4173/homepage/) and system Chrome (CHROME env to override).
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:4173/homepage/'
const out = process.argv[3] ?? 'shots'
const email = process.env.SHOT_EMAIL, password = process.env.SHOT_PASSWORD
if (!email || !password) { console.error('SHOT_EMAIL and SHOT_PASSWORD are required'); process.exit(1) }
mkdirSync(out, { recursive: true })

const SIZES = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true }, tablet: { width: 820, height: 1180 }, desktop: { width: 1366, height: 900 } }
const ROUTES = { feed: '#/', saved: '#/saved', settings: '#/settings' }
const only = (process.env.SHOT_ONLY ?? '').split(',').filter(Boolean) // e.g. "phone-dark-settings"
const combos = (process.env.SHOT_COMBOS ?? '').split(',').filter(Boolean) // e.g. "phone-light" to redo one size/scheme
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Full-page capture by growing the viewport to the document height (fullPage:true is unreliable on older Chrome).
async function shoot(page, size, path, maxHeight = 8000) {
  const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight))
  await page.setViewport({ width: size.width, height: Math.min(Math.max(h, size.height), maxHeight), isMobile: !!size.isMobile, hasTouch: !!size.hasTouch, deviceScaleFactor: 1 })
  await sleep(1200) // lazy images below the fold
  await page.screenshot({ path })
  await page.setViewport({ width: size.width, height: size.height, isMobile: !!size.isMobile, hasTouch: !!size.hasTouch, deviceScaleFactor: 1 })
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] })
try {
  for (const [sizeName, size] of Object.entries(SIZES)) {
    for (const scheme of ['light', 'dark']) {
      if (combos.length && !combos.includes(`${sizeName}-${scheme}`)) continue
      const ctx = await browser.createBrowserContext() // fresh storage: every combination starts at the login page
      const page = await ctx.newPage()
      await page.setViewport({ width: size.width, height: size.height, isMobile: !!size.isMobile, hasTouch: !!size.hasTouch, deviceScaleFactor: 1 })
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
      page.on('pageerror', (e) => console.error(`[${sizeName}/${scheme}] page error:`, e.message))
      await page.goto(base, { waitUntil: 'networkidle0' })
      await shoot(page, size, `${out}/${sizeName}-${scheme}-login.png`)
      if (await page.$('form.login')) { // the session persists across pages of the same browser
        await page.click('form.login button.btn.ghost')
        await page.waitForSelector('input[type=password]')
        await page.type('input[type=email]', email)
        await page.type('input[type=password]', password)
        await page.click('form.login button[type=submit]')
      }
      await page.waitForSelector('.hero', { timeout: 30000 })
      for (const [routeName, hash] of Object.entries(ROUTES)) {
        const id = `${sizeName}-${scheme}-${routeName}`
        if (only.length && !only.includes(id)) continue
        await page.goto(base + hash, { waitUntil: 'networkidle0' })
        await sleep(1500)
        await shoot(page, size, `${out}/${id}.png`, routeName === 'feed' ? 3600 : 8000)
        console.log('saved', id)
      }
      await page.goto(base + '#/', { waitUntil: 'networkidle0' })
      const readerHref = await page.$eval('a.icon-btn[href^="#/read/"]', (a) => a.getAttribute('href')).catch(() => null)
      if (readerHref) {
        await page.goto(base + readerHref, { waitUntil: 'networkidle0' }); await sleep(2500)
        await shoot(page, size, `${out}/${sizeName}-${scheme}-reader.png`); console.log('saved', `${sizeName}-${scheme}-reader`)
      }
      await ctx.close()
    }
  }
} finally { await browser.close() }
