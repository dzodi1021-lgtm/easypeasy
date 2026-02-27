import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../../lib/supabase.js";
import { json, requireMethod, readJson, setCookie, randomToken } from "../../lib/http.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  const body = await readJson(req);
  const { username, password } = body || {};

  if (!username || !password) return json(res, 400, { ok: false, message: "Missing fields" });

  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "change_me";

  // simple compare (si tu veux bcrypt, mets un hash dans env et compare avec bcrypt.compare)
  if (username !== adminUser || password !== adminPass) {
    return json(res, 401, { ok: false, message: "Invalid credentials" });
  }

  const sb = supabaseAdmin();
  const sessionToken = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await sb.from("admin_sessions").insert([{ session_token: sessionToken, expires_at: expiresAt }]);

  setCookie(res, "admin_session", sessionToken, {
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
    maxAge: SESSION_TTL_MS
  });

  return json(res, 200, { ok: true });
}