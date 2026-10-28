// Edge Function "reader": fetches an article and returns its readable content (Mozilla Readability).
// Only URLs that exist in feed_items are accepted, so the function cannot be used as a general proxy.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { DOMParser } from "jsr:@b-fuze/deno-dom";
import { Readability } from "npm:@mozilla/readability@0.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_500_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const authHeader = req.headers.get("Authorization") ?? "";
  const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const itemId = typeof body?.item_id === "string" ? body.item_id : null;
  if (!itemId) return json({ error: "item_id required" }, 400);

  const { data: item } = await client.from("feed_items").select("id,link,title,image_url").eq("id", itemId).maybeSingle();
  if (!item) return json({ error: "unknown item" }, 404);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(item.link, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ro,en;q=0.8",
      },
    });
    if (!res.ok) return json({ error: `HTTP ${res.status}` }, 502);
    const html = (await res.text()).slice(0, MAX_BYTES);
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return json({ error: "parse failed" }, 502);
    // Readability needs a base URI to resolve relative links and images.
    const base = doc.createElement("base");
    base.setAttribute("href", res.url || item.link);
    doc.head?.appendChild(base);
    // deno-lint-ignore no-explicit-any
    const article = new Readability(doc as any, { charThreshold: 200 }).parse();
    if (!article?.content) return json({ error: "no readable content" }, 422);
    return json({
      title: article.title || item.title,
      byline: article.byline ?? null,
      site_name: article.siteName ?? hostname(item.link),
      excerpt: article.excerpt ?? null,
      content: absolutize(article.content, res.url || item.link),
      length: article.length ?? null,
      url: res.url || item.link,
      image_url: item.image_url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 502);
  } finally {
    clearTimeout(timer);
  }
});

// Make src/href attributes absolute so images load from the reader view.
function absolutize(content: string, baseUrl: string): string {
  return content.replace(/\s(src|href)=["'](?!https?:|data:|mailto:|#)([^"']+)["']/gi, (_m, attr, val) => {
    try { return ` ${attr}="${new URL(val, baseUrl).href}"`; } catch { return ` ${attr}="${val}"`; }
  });
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
