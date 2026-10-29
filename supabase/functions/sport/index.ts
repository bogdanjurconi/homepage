// Edge Function "sport": the football teams a person follows, from football-data.org's free plan,
// cached in Postgres so the whole family shares the 10-requests-a-minute allowance.
//   POST { action: "teams" }                 -> teams of the free competitions (for the Settings search)
//   POST { action: "matches", ids: [..] }    -> per team: the match in play, the next one, the last one
// The API key lives in the function secret FOOTBALL_DATA_KEY, never in the client.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("FOOTBALL_DATA_KEY") ?? "";
const API = "https://api.football-data.org/v4";

const MAX_TEAMS = 5;
const TEAMS_TTL_MS = 7 * 86_400_000;
const COMPETITIONS_PER_CALL = 8; // leaves room under the free plan's 10 requests a minute
const LIVE_TTL_MS = 60_000;
const IDLE_TTL_MS = 6 * 3_600_000;
const BACK_DAYS = 3;
// National-team fixtures are not in the free plan (403 on /teams/{id}/matches), so those competitions are left out of the list.
const SKIPPED_COMPETITIONS = ["EC", "WC"];
const AHEAD_DAYS = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Side = { id: number; name: string; shortName: string | null; tla: string | null; crest: string | null };
type Match = {
  id: number; utcDate: string; status: string; minute: number | null;
  competition: { name: string; code: string; emblem: string | null };
  home: Side; away: Side; score: { home: number | null; away: number | null };
};
type TeamStatus = { team: Side; live: Match | null; next: Match | null; last: Match | null; error?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!API_KEY) return json({ error: "not configured" }, 503);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  try {
    if (body?.action === "teams") return json(await teams(admin));
    if (body?.action === "matches") {
      const ids = Array.isArray(body.ids) ? body.ids.filter((n: unknown) => Number.isInteger(n)).slice(0, MAX_TEAMS) as number[] : [];
      const out: TeamStatus[] = [];
      for (const id of ids) out.push(await teamStatus(admin, id)); // one at a time: the plan is rate limited per minute
      return json({ teams: out, at: new Date().toISOString() });
    }
    return json({ error: "unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});

// ---------- teams (Settings search) ----------
async function teams(admin: SupabaseClient) {
  const now = Date.now();
  const { data: comps } = await admin.from("sport_competitions").select("code,name,emblem,teams_fetched_at");
  let list = (comps ?? []).filter((c) => !SKIPPED_COMPETITIONS.includes(c.code));
  if (list.length === 0) {
    const res = await api("/competitions") as { competitions: { code: string; name: string; emblem: string | null; plan: string }[] };
    const free = res.competitions.filter((c) => c.plan === "TIER_ONE" && !SKIPPED_COMPETITIONS.includes(c.code)).map((c) => ({ code: c.code, name: c.name, emblem: c.emblem }));
    if (free.length) await admin.from("sport_competitions").upsert(free);
    list = free.map((c) => ({ ...c, teams_fetched_at: null }));
  }
  const due = list.filter((c) => !c.teams_fetched_at || now - Date.parse(c.teams_fetched_at) > TEAMS_TTL_MS).slice(0, COMPETITIONS_PER_CALL);
  const fetched = new Set(list.filter((c) => c.teams_fetched_at && now - Date.parse(c.teams_fetched_at) <= TEAMS_TTL_MS).map((c) => c.code));
  if (due.length) {
    const { data: existing } = await admin.from("sport_teams").select("id,competitions");
    const known = new Map<number, string[]>((existing ?? []).map((t) => [t.id, t.competitions ?? []]));
    for (const c of due) {
      let res: { teams: { id: number; name: string; shortName: string | null; tla: string | null; crest: string | null; area?: { name: string } }[] };
      try { res = await api(`/competitions/${c.code}/teams`) as typeof res; } catch { break; } // rate limited: serve what we have, finish next time
      const rows = res.teams.map((t) => {
        const comps = new Set(known.get(t.id) ?? []); comps.add(c.code); known.set(t.id, [...comps]);
        return { id: t.id, name: t.name, short_name: t.shortName, tla: t.tla, crest: t.crest, area: t.area?.name ?? null, competitions: [...comps], updated_at: new Date().toISOString() };
      });
      if (rows.length) await admin.from("sport_teams").upsert(rows);
      await admin.from("sport_competitions").update({ teams_fetched_at: new Date().toISOString() }).eq("code", c.code);
      fetched.add(c.code);
    }
  }
  const { data: all } = await admin.from("sport_teams").select("id,name,short_name,tla,crest,area,competitions").order("name");
  const complete = list.length > 0 && list.every((c) => fetched.has(c.code));
  const usable = (all ?? []).filter((t) => (t.competitions ?? []).some((c: string) => !SKIPPED_COMPETITIONS.includes(c)));
  return { teams: usable, competitions: list.map((c) => ({ code: c.code, name: c.name })), complete };
}

// ---------- matches (front-page card) ----------
async function teamStatus(admin: SupabaseClient, id: number): Promise<TeamStatus> {
  const key = `team:${id}`;
  const { data: cached } = await admin.from("sport_cache").select("payload,fetched_at").eq("key", key).maybeSingle();
  const now = Date.now();
  let payload = cached?.payload as { team: Side; matches: Match[] } | undefined;
  const fresh = cached && now - Date.parse(cached.fetched_at) < ttlFor(payload?.matches ?? [], now);
  if (!fresh) {
    try {
      const from = isoDay(now - BACK_DAYS * 86_400_000), to = isoDay(now + AHEAD_DAYS * 86_400_000);
      const res = await api(`/teams/${id}/matches?dateFrom=${from}&dateTo=${to}&limit=30`) as { matches: RawMatch[] };
      const matches = res.matches.map(trim).sort((a, b) => a.utcDate.localeCompare(b.utcDate));
      const team = sideOf(matches, id) ?? payload?.team ?? await teamRow(admin, id);
      payload = { team, matches };
      await admin.from("sport_cache").upsert({ key, payload, fetched_at: new Date().toISOString() });
    } catch (err) {
      if (!payload) return { team: await teamRow(admin, id), live: null, next: null, last: null, error: err instanceof Error ? err.message : String(err) };
      // rate limited or the API is down: the stale copy is better than nothing
    }
  }
  return pick(payload!, now);
}

function pick(p: { team: Side; matches: Match[] }, now: number): TeamStatus {
  const m = p.matches;
  const live = m.find((x) => x.status === "IN_PLAY" || x.status === "PAUSED") ?? null;
  const next = m.find((x) => (x.status === "SCHEDULED" || x.status === "TIMED") && Date.parse(x.utcDate) > now - 3 * 3_600_000) ?? null;
  const last = [...m].reverse().find((x) => (x.status === "FINISHED" || x.status === "AWARDED") && Date.parse(x.utcDate) > now - BACK_DAYS * 86_400_000) ?? null;
  return { team: p.team, live, next, last };
}

// A minute while a match is on (or about to start), otherwise until the next kick-off, at most a few hours.
function ttlFor(matches: Match[], now: number): number {
  if (matches.some((x) => x.status === "IN_PLAY" || x.status === "PAUSED")) return LIVE_TTL_MS;
  const next = matches.find((x) => (x.status === "SCHEDULED" || x.status === "TIMED") && Date.parse(x.utcDate) > now - 3 * 3_600_000);
  if (!next) return IDLE_TTL_MS;
  const until = Date.parse(next.utcDate) - now;
  return Math.max(LIVE_TTL_MS, Math.min(IDLE_TTL_MS, until));
}

type RawSide = { id: number; name: string; shortName?: string | null; tla?: string | null; crest?: string | null };
type RawMatch = {
  id: number; utcDate: string; status: string; minute?: number | null;
  competition: { name: string; code: string; emblem?: string | null };
  homeTeam: RawSide; awayTeam: RawSide; score: { fullTime: { home: number | null; away: number | null } };
};
const side = (s: RawSide): Side => ({ id: s.id, name: s.name, shortName: s.shortName ?? null, tla: s.tla ?? null, crest: s.crest ?? null });
const trim = (m: RawMatch): Match => ({
  id: m.id, utcDate: m.utcDate, status: m.status, minute: m.minute ?? null,
  competition: { name: m.competition.name, code: m.competition.code, emblem: m.competition.emblem ?? null },
  home: side(m.homeTeam), away: side(m.awayTeam), score: { home: m.score.fullTime.home, away: m.score.fullTime.away },
});
function sideOf(matches: Match[], id: number): Side | null {
  for (const m of matches) { if (m.home.id === id) return m.home; if (m.away.id === id) return m.away; }
  return null;
}
async function teamRow(admin: SupabaseClient, id: number): Promise<Side> {
  const { data } = await admin.from("sport_teams").select("id,name,short_name,tla,crest").eq("id", id).maybeSingle();
  return data ? { id: data.id, name: data.name, shortName: data.short_name, tla: data.tla, crest: data.crest } : { id, name: `#${id}`, shortName: null, tla: null, crest: null };
}

async function api(path: string): Promise<unknown> {
  const res = await fetch(API + path, { headers: { "X-Auth-Token": API_KEY } });
  if (res.status === 429) throw new Error("rate limited");
  if (!res.ok) throw new Error(`football-data HTTP ${res.status}`);
  return res.json();
}
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
