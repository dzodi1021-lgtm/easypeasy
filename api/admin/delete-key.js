import { supabaseAdmin } from "../../lib/supabase.js";
import { json, requireMethod, parseCookies, readJson } from "../../lib/http.js";

async function requireAdmin(req, res) {
  const sb = supabaseAdmin();
  const cookies = parseCookies(req);
  const tok = cookies.admin_session;
  if (!tok) { json(res, 401, { ok: false, message: "Unauthorized" }); return null; }

  const { data, error } = await sb
    .from("admin_sessions")
    .select("*")
    .eq("session_token", tok)
    .limit(1);

  if (error || !data || data.length === 0) { json(res, 401, { ok: false, message: "Unauthorized" }); return null; }
  if (new Date(data[0].expires_at) < new Date()) { json(res, 401, { ok: false, message: "Session expired" }); return null; }

  return sb;
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, "DELETE")) return;
  const sb = await requireAdmin(req, res);
  if (!sb) return;

  const url = new URL(req.url, `https://${req.headers.host}`);
  const id = url.searchParams.get("id");

  if (!id) return json(res, 400, { ok: false, message: "Missing id" });

  const { error } = await sb.from("keys").delete().eq("id", Number(id));
  if (error) return json(res, 500, { ok: false, message: "DB error" });

  return json(res, 200, { ok: true });
}