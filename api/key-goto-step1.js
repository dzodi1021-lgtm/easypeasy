import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { redirect } from "../lib/http.js";

const WORKINK_STEP1 = process.env.WORKINK_STEP1_URL || "https://work.ink/2kKN/step1";
const TOKEN_TTL_MS = 15 * 60 * 1000;

function getBaseUrl(req) {
  const host = req.headers.host || "localhost:3000";
  return `https://${host}`;
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  let ip = "";
  if (typeof xff === "string" && xff) ip = xff.split(",")[0].trim();
  else if (Array.isArray(xff) && xff.length) ip = String(xff[0]).trim();
  else ip = req.socket?.remoteAddress || "";
  ip = ip.replace(/:\d+$/, "");
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip || "unknown";
}
function getUserAgent(req) {
  return req.headers["user-agent"] || "";
}
function ipPrefix(ip) {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : ip;
  }
  const hextets = ip.split(":").filter(Boolean);
  return hextets.slice(0, 4).join(":") || ip;
}
function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}
function randomId(len=18) {
  return crypto.randomBytes(len).toString("hex");
}

export default async function handler(req, res) {
  const sb = supabaseAdmin();
  const sid = randomId();
  const ip = ipPrefix(getClientIp(req));
  const ua = getUserAgent(req);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await sb.from("keyflow_sessions").insert({
    id: sid,
    step: 1,
    ip_hash: sha256Hex(ip),
    ua_hash: sha256Hex(ua),
    expires_at: expiresAt
  });

  const base = getBaseUrl(req);
  const redirectUrl = `${base}/key?step=1&sid=${encodeURIComponent(sid)}`;
  const workinkUrl = WORKINK_STEP1.includes("?")
    ? `${WORKINK_STEP1}&redirect=${encodeURIComponent(redirectUrl)}`
    : `${WORKINK_STEP1}?redirect=${encodeURIComponent(redirectUrl)}`;

  return redirect(res, 302, workinkUrl);
}
