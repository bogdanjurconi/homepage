// Edge Function "feeds"
// Returns the signed-in user's enabled sources and their cached items.
// Feeds older than STALE_MINUTES are re-fetched server-side, in the background: the answer comes from the
// cache at once and the client asks again a few seconds later for what the refresh brought.
// Writes use the service role; reads are restricted to the caller's own source list.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { parseFeed, MediaRss } from "jsr:@mikaelporttila/rss@1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STALE_MINUTES = 15;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_ITEMS_PER_FEED = 40;
const KEEP_DAYS = 14;
const MAX_ITEMS_RETURNED = 300;
// ...and at least this many of every source, so a weekly source still has a row in the "Sources" layout
const MIN_PER_FEED = 12;
// How long a request waits for a refresh it cannot answer from the cache (a source never fetched, or Refresh pressed)
const FIRST_WAIT_MS = 6_000;
// Feeds without pictures (HotNews): take the article's og:image, a few new articles per refresh.
const PAGE_IMAGES_PER_REFRESH = 20;
const PAGE_TIMEOUT_MS = 5_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Source = { name: string; url: string; category: string; sort_order: number; is_custom: boolean };

// Supabase's edge runtime keeps the isolate alive for promises handed to waitUntil after the response is sent.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const force = body?.force === true;

  const sources = await loadSources(admin, user.id);
  const urls = sources.map((s) => s.url);
  if (urls.length === 0) return json({ sources: [], items: [], refreshed: 0, refreshing: [] });

  // This request claims the stale feeds (claim_feeds marks them, so two people opening the page at once do
  // not both refresh them) and refreshes them after answering. Only a source never fetched before, or an
  // explicit Refresh, is waited for, and only a little, so the page is not empty.
  const started = Date.now();
  const { data: states } = await admin.from("feeds").select("url,last_fetched_at").in("url", urls);
  const lastOf = (u: string) => states?.find((s) => s.url === u)?.last_fetched_at ?? null;
  const { data: claimed } = await admin.rpc("claim_feeds", { urls, min_age: force ? "0 seconds" : `${STALE_MINUTES} minutes` });
  const claimedUrls: string[] = Array.isArray(claimed) ? claimed : [];
  const refresh = Promise.allSettled(claimedUrls.map((u) => refreshFeed(admin, u, lastOf(u))));
  if (force || claimedUrls.some((u) => !lastOf(u))) await Promise.race([refresh, new Promise((r) => setTimeout(r, FIRST_WAIT_MS))]);
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(refresh); else await refresh;

  const [{ data: items }, { data: finalStates }] = await Promise.all([
    admin.rpc("feed_items_for", { urls, per_feed: MIN_PER_FEED, total: MAX_ITEMS_RETURNED }),
    admin.from("feeds").select("url,title,last_fetched_at,last_error").in("url", urls),
  ]);

  const out = sources.map((s) => ({ ...s, ...(finalStates?.find((x) => x.url === s.url) ?? {}) }));
  // Sources still refreshing when this answer left: the client asks again shortly for the stories they bring.
  const refreshing = claimedUrls.filter((u) => {
    const t = finalStates?.find((x) => x.url === u)?.last_fetched_at;
    return !t || Date.parse(t) < started;
  });
  return json({ sources: out, items: items ?? [], refreshed: claimedUrls.length, refreshing, retry_after_ms: refreshing.length ? 8_000 : 0 });
});

async function loadSources(admin: SupabaseClient, userId: string): Promise<Source[]> {
  const [{ data: defaults }, { data: overrides }] = await Promise.all([
    admin.from("default_sources").select("id,name,url,category,enabled_by_default,sort_order").order("sort_order"),
    admin.from("user_sources").select("default_source_id,name,url,enabled,sort_order").eq("user_id", userId),
  ]);
  const sources: Source[] = [];
  for (const d of defaults ?? []) {
    const o = overrides?.find((x) => x.default_source_id === d.id);
    const enabled = o ? o.enabled : d.enabled_by_default;
    if (enabled) sources.push({ name: d.name, url: d.url, category: d.category, sort_order: d.sort_order, is_custom: false });
  }
  for (const o of overrides ?? []) {
    if (!o.default_source_id && o.enabled && o.url) {
      sources.push({ name: o.name || hostname(o.url), url: o.url, category: "custom", sort_order: 1000 + (o.sort_order ?? 0), is_custom: true });
    }
  }
  return sources;
}

async function refreshFeed(admin: SupabaseClient, url: string, prevFetchedAt: string | null) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let status = 0;
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HomepageFeedReader/1.0)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });
    status = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const feed = await parseFeed(xml);
    const raw = rawDescriptions(xml);
    const rows = feed.entries.slice(0, MAX_ITEMS_PER_FEED)
      .map((e) => toRow(url, e as Record<string, unknown>, fetchedAt, raw))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    await admin.from("feeds").upsert({ url, title: feed.title?.value ?? null, last_fetched_at: fetchedAt, last_status: status, last_error: null, refreshing_at: null });
    await fillPageImages(admin, url, rows);
    if (rows.length) {
      const { error } = await admin.from("feed_items").upsert(rows, { onConflict: "feed_url,guid" });
      if (error) throw error;
    }
    // Retention once a day per feed; prune_feed_items keeps the stories people saved.
    if ((prevFetchedAt ?? "").slice(0, 10) !== fetchedAt.slice(0, 10)) {
      await admin.rpc("prune_feed_items", { feed: url, cutoff: new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString() });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from("feeds").upsert({ url, last_fetched_at: fetchedAt, last_status: status, last_error: message.slice(0, 300), refreshing_at: null });
  } finally {
    clearTimeout(timer);
  }
}

// Items whose feed entry has no picture keep the one found earlier, else get the page's og:image.
async function fillPageImages(admin: SupabaseClient, feedUrl: string, rows: { guid: string; link: string; image_url: string | null; page_image_checked: boolean }[]) {
  const missing = rows.filter((r) => !r.image_url);
  if (!missing.length) return;
  const { data: known } = await admin.from("feed_items").select("guid,image_url,page_image_checked")
    .eq("feed_url", feedUrl).in("guid", missing.map((r) => r.guid));
  const todo: typeof missing = [];
  for (const r of missing) {
    const k = known?.find((x) => x.guid === r.guid);
    if (k?.image_url) r.image_url = k.image_url;
    else if (!k?.page_image_checked) todo.push(r);
    r.page_image_checked = !!k?.page_image_checked;
  }
  await Promise.all(todo.slice(0, PAGE_IMAGES_PER_REFRESH).map(async (r) => {
    r.image_url = await pageImage(r.link);
    r.page_image_checked = true;
  }));
}

async function pageImage(link: string): Promise<string | null> {
  try {
    const res = await fetch(link, {
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HomepageFeedReader/1.0)", "Accept": "text/html" },
    });
    if (!res.ok || !res.body) return null;
    // The meta tags sit in <head>: read until it closes, not the whole page.
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let head = "";
    while (head.length < 300_000) {
      const { value, done } = await reader.read();
      if (done) break;
      head += value;
      if (head.includes("</head>")) break;
    }
    reader.cancel().catch(() => {});
    const m = head.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/i)
      ?? head.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    return m?.[1] ? new URL(decodeEntities(m[1]), link).href : null;
  } catch {
    return null;
  }
}

// deno-lint-ignore no-explicit-any
function toRow(feedUrl: string, e: any, fetchedAt: string, raw: Map<string, string>) {
  const link: string | undefined = e.links?.[0]?.href ?? e.links?.[0]?.url ?? e.id;
  const title: string | undefined = e.title?.value?.trim();
  if (!link || !title) return null;
  let rawHtml: string = e.description?.value ?? e.content?.value ?? "";
  // Some feeds (GSMArena) mix entity-encoded HTML and CDATA in one <description>, which the parser
  // reduces to a fragment. Fall back to the description text taken straight from the XML.
  if (stripHtml(rawHtml).replace(/\]\]>/g, "").trim().length < 20) rawHtml = raw.get(link) ?? raw.get(String(e.id ?? "")) ?? rawHtml;
  const html = /&lt;(img|p|a|br)\b/i.test(rawHtml) ? decodeEntities(rawHtml) : rawHtml;
  const summary = stripHtml(html).replace(/\[#[^\]]*#\]/g, "").replace(/\s+/g, " ").trim().slice(0, 300) || null;
  const published = toIso(e.published) ?? toIso(e.updated);
  return {
    feed_url: feedUrl,
    guid: String(e.id ?? link),
    title,
    link,
    summary,
    image_url: findImage(e, html),
    page_image_checked: false,
    published_at: published,
    fetched_at: fetchedAt,
  };
}

// deno-lint-ignore no-explicit-any
function findImage(e: any, html: string): string | null {
  const media = e[MediaRss.Content];
  if (Array.isArray(media)) {
    const img = media.find((m: { url?: string; medium?: string; type?: string }) =>
      m.url && (m.medium === "image" || m.type?.startsWith("image/") || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(m.url)));
    if (img?.url) return img.url;
  }
  const thumbs = e[MediaRss.Thumbnails];
  if (Array.isArray(thumbs) && thumbs[0]?.url) return thumbs[0].url;
  const att = e.attachments?.find((a: { url?: string; mimeType?: string }) => a.url && (a.mimeType?.startsWith("image/") ?? true));
  if (att?.url) return att.url;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ? upscaleKnownThumbnail(m[1]) : null;
}

// GSMArena's RSS only carries a 184x111 thumbnail; the same path exists at a larger size.
function upscaleKnownThumbnail(url: string): string {
  if (/fdn\.gsmarena\.com\/.*\/-184x111\//.test(url)) return url.replace("/-184x111/", "/-728x314/");
  return url;
}

// link (or guid) -> raw inner text of <description>, CDATA unwrapped, for every <item>/<entry> in the XML.
function rawDescriptions(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  const itemRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of xml.matchAll(itemRe)) {
    const body = m[2];
    const desc = body.match(/<(description|summary|content(?::encoded)?)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
    if (!desc) continue;
    const text = desc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/\]\]>/g, "").trim();
    const link = body.match(/<link\b[^>]*>([^<]+)<\/link>/i)?.[1]?.trim() ?? body.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1];
    const guid = body.match(/<(guid|id)\b[^>]*>([^<]+)<\/\1>/i)?.[2]?.trim();
    if (link) out.set(link, text);
    if (guid) out.set(guid, text);
  }
  return out;
}

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
