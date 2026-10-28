// Edge Function "admin": account management for administrators (profiles.is_admin = true).
// Actions: list accounts, invite by email, remove an account. Public sign-up is disabled,
// so invitations are the only way in.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://bogdanjurconi.github.io/homepage/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: me } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "list") return json({ accounts: await listAccounts(admin) });

  if (action === "invite") {
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_email" }, 400);
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: SITE_URL });
    if (error) return json({ error: error.message, code: error.code ?? null }, 400);
    return json({ ok: true, accounts: await listAccounts(admin) });
  }

  if (action === "remove") {
    const id = String(body?.user_id ?? "");
    if (!id) return json({ error: "user_id required" }, 400);
    if (id === user.id) return json({ error: "cannot_remove_self" }, 400);
    const { data: target } = await admin.from("profiles").select("is_admin").eq("id", id).maybeSingle();
    if (target?.is_admin) return json({ error: "cannot_remove_admin" }, 400);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, accounts: await listAccounts(admin) });
  }

  return json({ error: "unknown action" }, 400);
});

// deno-lint-ignore no-explicit-any
async function listAccounts(admin: any) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const ids = data.users.map((u: { id: string }) => u.id);
  const { data: profiles } = await admin.from("profiles").select("id,display_name,is_admin").in("id", ids);
  // deno-lint-ignore no-explicit-any
  return data.users.map((u: any) => {
    const p = profiles?.find((x: { id: string }) => x.id === u.id);
    return {
      id: u.id,
      email: u.email,
      display_name: p?.display_name ?? null,
      is_admin: p?.is_admin ?? false,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      invited_at: u.invited_at ?? null,
      // An invited account that has never signed in is still pending.
      status: u.last_sign_in_at ? "active" : (u.invited_at ? "invited" : "inactive"),
    };
  }).sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
