// Edge Function "rates": daily reference rates in RON, from the European Central Bank's public XML.
// (BNR's nbrfxrates.xml sits behind a redirect/verification page, so the ECB feed is used instead.)
// Cached in memory for an hour; the ECB publishes once per working day around 16:00 CET.
const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const WANTED = ["EUR", "USD", "GBP", "CHF", "HUF"];
const CACHE_MS = 60 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Rates = { date: string; base: "RON"; source: "ECB"; rates: { code: string; value: number; multiplier: number }[] };
let cache: { at: number; data: Rates } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      const res = await fetch(ECB_URL, { headers: { "User-Agent": "HomepageFeedReader/1.0 (+https://bogdanjurconi.github.io/homepage/)" } });
      if (!res.ok) throw new Error(`ECB HTTP ${res.status}`);
      cache = { at: Date.now(), data: parse(await res.text()) };
    }
    return new Response(JSON.stringify(cache.data), {
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

// ECB gives units of each currency per 1 EUR. Convert to RON per unit of currency.
function parse(xml: string): Rates {
  const date = xml.match(/<Cube\s+time=['"]([^'"]+)['"]/)?.[1] ?? new Date().toISOString().slice(0, 10);
  const perEur = new Map<string, number>();
  for (const m of xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) perEur.set(m[1], Number(m[2]));
  const ron = perEur.get("RON");
  if (!ron) throw new Error("RON missing from ECB feed");
  const rates: Rates["rates"] = [];
  for (const code of WANTED) {
    const multiplier = code === "HUF" ? 100 : 1;
    const value = code === "EUR" ? ron : ron / (perEur.get(code) ?? NaN) * multiplier;
    if (Number.isFinite(value)) rates.push({ code, value: Number(value.toFixed(4)), multiplier });
  }
  return { date, base: "RON", source: "ECB", rates };
}
