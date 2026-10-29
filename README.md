# Homepage

A calm, ad-free start page for the family: news from chosen RSS sources grouped in sections, an ad-free web search bar, quick links, weather, exchange rates, followed football teams (next match and live score), a Romanian holidays and name-days calendar, reader mode, saved articles, and per-person settings (language, theme, accent colour, font, background, text size, layout).

Live: https://bogdanjurconi.github.io/homepage/

## Stack

- React 19 + Vite + TypeScript, hosted on GitHub Pages (deployed by `.github/workflows/deploy.yml` on every push to `main`).
- Supabase: Auth (email magic link), Postgres with row-level security, and Edge Functions: `feeds` (fetches and caches RSS server-side), `reader` (Mozilla Readability extraction for items in the feed cache), `rates` (ECB reference rates in RON), `sport` (football-data.org fixtures and live scores for followed teams, cached in Postgres), `admin` (invitations).

## Local development

```sh
npm install
npm run dev        # http://localhost:5173/homepage/
npm run build      # type-check + production build into dist/
npm run lint
```

The browser only needs the Supabase URL and publishable key, which live in `src/lib/supabase.ts` and are safe to commit.

## Supabase

Schema and policies: `supabase/migrations/`. Edge Functions: `supabase/functions/{feeds,reader,rates,sport,admin}/`.

The `sport` function needs a [football-data.org](https://www.football-data.org/) key (free plan) stored as a function secret: `npx supabase secrets set FOOTBALL_DATA_KEY=... --project-ref "$SUPABASE_PROJECT_REF"`.

Admin work (migrations, function deploys) uses a project-scoped personal access token kept in `.env` (git-ignored):

```
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_PROJECT_REF=...
```

```sh
set -a; . ./.env; set +a
npx supabase functions deploy feeds --project-ref "$SUPABASE_PROJECT_REF" --use-api   # or reader / rates
```

## Data model

| Table | Purpose |
|---|---|
| `profiles` | one row per user: name, language, theme, accent, text size, layout, weather location |
| `default_sources` | curated feeds everyone can pick from |
| `user_sources` | per-user on/off overrides for defaults, plus custom RSS feeds |
| `feeds` / `feed_items` | server-side cache of fetched feeds, written only by the Edge Function |
| `saved_articles` | bookmarks |
| `quick_links` | per-user tiles shown under the search bar |
| `sport_teams` / `sport_competitions` / `sport_cache` | football-data.org team list and per-team match cache, written only by the `sport` function |

PWA icons are rendered from the SVG mark with `node scripts/icons.mjs`.

## Screenshots

`scripts/screenshots.mjs` captures every page at phone, tablet and desktop widths, light and dark, using the system Chrome (puppeteer-core). It needs a running `npm run preview` and a test account:

```sh
SHOT_EMAIL=... SHOT_PASSWORD=... node scripts/screenshots.mjs http://localhost:4173/homepage/ shots
```

`SHOT_COMBOS=phone-light` limits the run to one size/scheme and `SHOT_ONLY=phone-light-settings` to one capture.
