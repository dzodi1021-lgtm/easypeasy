import { supabaseAdmin } from "../lib/supabase.js";
import { json, requireMethod, readJson } from "../lib/http.js";

function durationToSeconds(type) {
  switch (type) {
    case "1d": return 86400;
    case "3d": return 3 * 86400;
    case "7d": return 7 * 86400;
    case "14d": return 14 * 86400;
    case "30d": return 30 * 86400;
    case "lifetime": return null;
    default: return null;
  }
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  const body = await readJson(req);
  const { key, hwid, username, userId } = body || {};

  if (!key || !hwid || !username || !userId) {
    return json(res, 400, { ok: false, message: "Missing fields" });
  }

  const sb = supabaseAdmin();
  const now = new Date();

  const { data: rows, error } = await sb
    .from("keys")
    .select("*")
    .eq("key_value", key)
    .limit(1);

  if (error) return json(res, 500, { ok: false, message: "DB error" });
  if (!rows || rows.length === 0) return json(res, 200, { ok: false, message: "Key invalid" });

  const k = rows[0];

  if (k.expires_at && new Date(k.expires_at) < now) {
    await sb.from("keys").update({ status: "expired" }).eq("id", k.id);
    return json(res, 200, { ok: false, message: "Key expired" });
  }

  // first bind
  if (!k.first_used_at) {
    const durSec = durationToSeconds(k.duration_type);
    let expiresAt = null;
    if (durSec) expiresAt = new Date(now.getTime() + durSec * 1000).toISOString();

    const { error: uerr } = await sb
      .from("keys")
      .update({
        first_used_at: now.toISOString(),
        expires_at: expiresAt,
        hwid,
        roblox_username: username,
        roblox_user_id: String(userId),
        status: "active",
      })
      .eq("id", k.id);

    if (uerr) return json(res, 500, { ok: false, message: "DB error" });

    return json(res, 200, { ok: true, message: "Key bound and valid", lifetime: k.duration_type === "lifetime" });
  }

  if (k.hwid && k.hwid !== hwid) {
    return json(res, 200, { ok: false, message: "Key is HWID locked" });
  }

  return json(res, 200, { ok: true, message: "Key valid", lifetime: k.duration_type === "lifetime" });
}