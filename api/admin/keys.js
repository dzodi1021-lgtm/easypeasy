import crypto from "crypto";
import { supabaseAdmin } from "../../lib/supabase.js";
import { json, readJson, parseCookies } from "../../lib/http.js";
import { credentialsSignature } from "../../lib/workink.js";

async function requireAdmin(req, res) {
  const sb = supabaseAdmin();
  const cookies = parseCookies(req);
  const tok = cookies.admin_session;

  if (!tok) {
    json(res, 401, { ok: false, message: "Unauthorized" });
    return null;
  }

  const { data, error } = await sb
    .from("admin_sessions")
    .select("*")
    .eq("session_token", tok)
    .limit(1);

  if (error || !data || data.length === 0) {
    json(res, 401, { ok: false, message: "Unauthorized" });
    return null;
  }

  if (new Date(data[0].expires_at) < new Date()) {
    json(res, 401, { ok: false, message: "Session expired" });
    return null;
  }

  const curSig = credentialsSignature();
  if (data[0].cred_sig && data[0].cred_sig !== curSig) {
    json(res, 401, { ok: false, message: "Session expired" });
    return null;
  }

  return sb;
}

function randomBlock4() {
  // A-Z0-9
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[crypto.randomInt(0, chars.length)];
  return out;
}

function generateOrisKey() {
  return `ORIS-${randomBlock4()}-${randomBlock4()}-${randomBlock4()}`;
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

    // générer une clé unique
    let key_value = "";
    for (let tries = 0; tries < 8; tries++) {
      key_value = generateOrisKey();
      const { data: exists, error: e2 } = await sb
        .from("keys")
        .select("id")
        .eq("key_value", key_value)
        .limit(1);

      if (e2) return json(res, 500, { ok: false, message: "DB error" });
      if (!exists || exists.length === 0) break; // unique ok
      key_value = "";
    }

    if (!key_value) return json(res, 500, { ok: false, message: "Failed to generate unique key" });

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

