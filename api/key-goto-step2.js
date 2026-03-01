import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { redirect } from "../lib/http.js";

const WORKINK_STEP2 = process.env.WORKINK_STEP2_URL || "https://work.ink/2kKN/step2";
const TOKEN_TTL_MS = 15 * 60 * 1000;

function getBaseUrl(req) {
  const host = req.headers.host || "localhost:3000";
  return `https://${host}`;
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return String(xff[0]).trim();
  return (req.socket?.remoteAddress || "").toString();
}

function getUserAgent(req) {
  return (req.headers["user-agent"] || "").toString();
}

function sha256Hex(str) {
  return crypto.createHash("sha256").update(String(str || ""), "utf8").digest("hex");
}

function randomId(bytes = 18) {
  return crypto.randomBytes(bytes).toString("hex");
}

export default async function handler(req, res) {
  const sb = supabaseAdmin();

  const sid = randomId(18);
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await sb.from("keyflow_sessions").insert([{
    id: sid,
    step: 2,
    ip_hash: sha256Hex(ip),
    ua_hash: sha256Hex(ua),
    expires_at: expiresAt
  }]);

  const base = getBaseUrl(req);
  const redirectUrl = `${base}/key?step=2&sid=${encodeURIComponent(sid)}`;

  const workinkUrl = WORKINK_STEP2.includes("?")
    ? `${WORKINK_STEP2}&redirect=${encodeURIComponent(redirectUrl)}`
    : `${WORKINK_STEP2}?redirect=${encodeURIComponent(redirectUrl)}`;

  return redirect(res, 302, workinkUrl);
}
