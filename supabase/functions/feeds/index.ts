// Edge Function "feeds"
// Returns the signed-in user's enabled sources and their cached items.
// Feeds older than STALE_MINUTES are re-fetched server-side first (avoids CORS in the browser).
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
const MAX_ITEMS_RETURNED = 400;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Source = { name: string; url: string; category: string; sort_order: number; is_custom: boolean };

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
  if (urls.length === 0) return json({ sources: [], items: [] });

  const { data: states } = await admin.from("feeds").select("url,last_fetched_at").in("url", urls);
  const now = Date.now();
  const stale = sources.filter((s) => {
    const st = states?.find((x) => x.url === s.url);
    return force || !st?.last_fetched_at || now - Date.parse(st.last_fetched_at) > STALE_MINUTES * 60_000;
  });
  await Promise.all(stale.map((s) => refreshFeed(admin, s.url)));

  const [{ data: items }, { data: finalStates }] = await Promise.all([
    admin.from("feed_items")
      .select("id,feed_url,title,link,summary,image_url,published_at")
      .in("feed_url", urls)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(MAX_ITEMS_RETURNED),
    admin.from("feeds").select("url,title,last_fetched_at,last_error").in("url", urls),
  ]);

  const out = sources.map((s) => ({ ...s, ...(finalStates?.find((x) => x.url === s.url) ?? {}) }));
  return json({ sources: out, items: items ?? [], refreshed: stale.length });
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

async function refreshFeed(admin: SupabaseClient, url: string) {
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
    const rows = feed.entries.slice(0, MAX_ITEMS_PER_FEED)
      .map((e) => toRow(url, e as Record<string, unknown>, fetchedAt))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    await admin.from("feeds").upsert({ url, title: feed.title?.value ?? null, last_fetched_at: fetchedAt, last_status: status, last_error: null });
    if (rows.length) {
      const { error } = await admin.from("feed_items").upsert(rows, { onConflict: "feed_url,guid" });
      if (error) throw error;
    }
    await admin.from("feed_items").delete().eq("feed_url", url)
      .lt("fetched_at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from("feeds").upsert({ url, last_fetched_at: fetchedAt, last_status: status, last_error: message.slice(0, 300) });
  } finally {
    clearTimeout(timer);
  }
}

// deno-lint-ignore no-explicit-any
function toRow(feedUrl: string, e: any, fetchedAt: string) {
  const link: string | undefined = e.links?.[0]?.href ?? e.links?.[0]?.url ?? e.id;
  const title: string | undefined = e.title?.value?.trim();
  if (!link || !title) return null;
  const html: string = e.description?.value ?? e.content?.value ?? "";
  const summary = stripHtml(html).slice(0, 300) || null;
  const published = toIso(e.published) ?? toIso(e.updated);
  return {
    feed_url: feedUrl,
    guid: String(e.id ?? link),
    title,
    link,
    summary,
    image_url: findImage(e, html),
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
  return m?.[1] ?? null;
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
