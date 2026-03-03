import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { redirect } from "../lib/http.js";

const WORKINK_STEP1 = process.env.WORKINK_STEP1_URL; // URL Work.ink étape 1
const TOKEN_TTL_MS   = 15 * 60 * 1000;              // TTL ~15 minutes

export default async function handler(req, res) {
  const sb = supabaseAdmin();

  // Génère un SID unique
  const sid = crypto.randomBytes(18).toString("hex");
  // Empreintes de l'utilisateur
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "";
  const ua = req.headers["user-agent"] || "";
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  // Insert session dans Supabase
  await sb.from("keyflow_sessions").insert({
    id: sid,
    step: 1,
    ip_hash: crypto.createHash("sha256").update(ip).digest("hex"),
    ua_hash: crypto.createHash("sha256").update(ua).digest("hex"),
    expires_at: expiresAt
  });

  // Détermine l'URL de retour pour Work.ink
  const base     = `https://${req.headers.host}`;
  const redirectUrl = `${base}/key?step=1&sid=${encodeURIComponent(sid)}`;
  // Construit l'URL Work.ink finale
  const workUrl = WORKINK_STEP1.includes("?")
                ? `${WORKINK_STEP1}&redirect=${encodeURIComponent(redirectUrl)}`
                : `${WORKINK_STEP1}?redirect=${encodeURIComponent(redirectUrl)}`;
  return redirect(res, 302, workUrl);
}
