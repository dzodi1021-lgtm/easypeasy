import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { redirect } from "../lib/http.js";

const WORKINK_STEP2 = process.env.WORKINK_STEP2_URL; // URL Work.ink étape 2
const TOKEN_TTL_MS   = 15 * 60 * 1000;              // TTL ~15 minutes

export default async function handler(req, res) {
  const sb = supabaseAdmin();

  const sid = crypto.randomBytes(18).toString("hex");
  const ip  = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "";
  const ua  = req.headers["user-agent"] || "";
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await sb.from("keyflow_sessions").insert({
    id: sid,
    step: 2,
    ip_hash: crypto.createHash("sha256").update(ip).digest("hex"),
    ua_hash: crypto.createHash("sha256").update(ua).digest("hex"),
    expires_at: expiresAt
  });

  const base     = `https://${req.headers.host}`;
  const redirectUrl = `${base}/key?step=2&sid=${encodeURIComponent(sid)}`;
  const workUrl = WORKINK_STEP2.includes("?")
                ? `${WORKINK_STEP2}&redirect=${encodeURIComponent(redirectUrl)}`
                : `${WORKINK_STEP2}?redirect=${encodeURIComponent(redirectUrl)}`;
  return redirect(res, 302, workUrl);
}
