// Edge Function "rates": reference rates in RON from the European Central Bank's public 90-day XML,
// with the change against the rate ~7 days earlier. Cached in memory for an hour.
// (BNR's own XML sits behind a verification redirect, so the ECB feed is used.)
const ECB_90D_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
const SUPPORTED = ["EUR", "USD", "GBP", "CHF", "HUF", "PLN", "CZK", "SEK", "NOK", "DKK", "CAD", "AUD", "JPY", "TRY", "BGN"];
const MULTIPLIER: Record<string, number> = { HUF: 100, JPY: 100 };
const CACHE_MS = 60 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Rate = { code: string; value: number; multiplier: number; prev_value: number | null; change: number | null; change_pct: number | null };
type Rates = { date: string; prev_date: string | null; base: "RON"; source: "ECB"; rates: Rate[] };
let cache: { at: number; data: Rates } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      const res = await fetch(ECB_90D_URL, { headers: { "User-Agent": "HomepageFeedReader/1.0 (+https://bogdanjurconi.github.io/homepage/)" } });
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

// The XML holds one <Cube time="YYYY-MM-DD"> per working day (newest first), each with
// <Cube currency="XXX" rate="..."/> children = units of XXX per 1 EUR.
function parse(xml: string): Rates {
  const days: { date: string; perEur: Map<string, number> }[] = [];
  for (const m of xml.matchAll(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>([\s\S]*?)<\/Cube>/g)) {
    const perEur = new Map<string, number>();
    for (const r of m[2].matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) perEur.set(r[1], Number(r[2]));
    days.push({ date: m[1], perEur });
  }
  days.sort((a, b) => b.date.localeCompare(a.date));
  if (days.length === 0) throw new Error("no data in ECB feed");
  const today = days[0];
  const cutoff = new Date(Date.parse(today.date) - 7 * 86_400_000).toISOString().slice(0, 10);
  const prev = days.find((d) => d.date <= cutoff) ?? null;

  const toRon = (day: { perEur: Map<string, number> }, code: string): number | null => {
    const ron = day.perEur.get("RON");
    if (!ron) return null;
    const mult = MULTIPLIER[code] ?? 1;
    if (code === "EUR") return ron;
    const per = day.perEur.get(code);
    return per ? (ron / per) * mult : null;
  };

  const rates: Rate[] = [];
  for (const code of SUPPORTED) {
    const value = toRon(today, code);
    if (value == null) continue;
    const prevValue = prev ? toRon(prev, code) : null;
    const change = prevValue != null ? value - prevValue : null;
    rates.push({
      code,
      value: round(value, 4),
      multiplier: MULTIPLIER[code] ?? 1,
      prev_value: prevValue != null ? round(prevValue, 4) : null,
      change: change != null ? round(change, 4) : null,
      change_pct: change != null && prevValue ? round((change / prevValue) * 100, 2) : null,
    });
  }
  return { date: today.date, prev_date: prev?.date ?? null, base: "RON", source: "ECB", rates };
}

const round = (n: number, d: number) => Number(n.toFixed(d));
