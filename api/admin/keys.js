import crypto from "crypto";
import { supabaseAdmin } from "../../lib/supabase.js";
import { json, readJson, parseCookies } from "../../lib/http.js";
import { credentialsSignature } from "../../lib/workink.js";

function hide(res) {
  // On “cache” l’endpoint
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not found");
}

async function requireAdmin(req, res) {
  const sb = supabaseAdmin();
  const cookies = parseCookies(req);
  const tok = cookies["__Host-admin_session"];

  if (!tok) { hide(res); return null; }

  const { data, error } = await sb
    .from("admin_sessions")
    .select("*")
    .eq("session_token", tok)
    .limit(1);

  if (error || !data || data.length === 0) { hide(res); return null; }
  if (new Date(data[0].expires_at) < new Date()) { hide(res); return null; }

  const curSig = credentialsSignature();
  if (data[0].cred_sig && data[0].cred_sig !== curSig) { hide(res); return null; }

  return sb;
}

function randomKey24() {
  return crypto.randomBytes(12).toString("hex");
}

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
    const duration_type = body?.duration_type || "1d";
    const key_value = randomKey24();

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
