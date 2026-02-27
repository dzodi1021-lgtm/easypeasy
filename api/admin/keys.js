import { supabaseAdmin } from "../../lib/supabase.js";
import { json, requireMethod, readJson, parseCookies } from "../../lib/http.js";

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

function randomKey24() {
  // 24 chars hex
  return crypto.randomBytes(12).toString("hex");
}

import crypto from "crypto";

export default async function handler(req, res) {
  const sb = await requireAdmin(req, res);
  if (!sb) return;

  if (req.method === "GET") {
    const { data, error } = await sb
      .from("keys")
      .select("*")
      .order("id", { ascending: false });

    if (error) return json(res, 500, { ok: false, message: "DB error" });
    return json(res, 200, data);
  }

  if (req.method === "POST") {
    const body = await readJson(req);
    const duration_type = body.duration_type || "1d";

    const key_value = crypto.randomBytes(12).toString("hex");

    const { data, error } = await sb
      .from("keys")
      .insert([{ key_value, duration_type }])
      .select("*")
      .limit(1);

    if (error) return json(res, 500, { ok: false, message: "DB error" });

    return json(res, 200, { ok: true, key: data[0] });
  }

  return json(res, 405, { ok: false, message: "Method not allowed" });
}