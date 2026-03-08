import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { redirect } from "../lib/http.js";

const WORKINK_STEP1 = process.env.WORKINK_STEP1_URL || "https://work.ink/2kKN/step1";
const FLOW_TTL_MS = 30 * 60 * 1000;

function rawIp(req) {
  const xff = req.headers["x-forwarded-for"];
  let ip = "";

  if (typeof xff === "string" && xff.length) ip = xff.split(",")[0].trim();
  else if (Array.isArray(xff) && xff.length) ip = String(xff[0]).trim();
  else ip = String(req.socket?.remoteAddress || "");

  ip = ip.replace(/:\d+$/, "");
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);

  return ip || "unknown";
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

export default async function handler(req, res) {
  const sb = supabaseAdmin();
  const ipHash = hashText(rawIp(req));
  const expiresAt = new Date(Date.now() + FLOW_TTL_MS).toISOString();

  await sb.from("key_flows").upsert([{
    ip_hash: ipHash,
    stage: 0,
    expires_at: expiresAt,
    updated_at: new Date().toISOString()
  }], { onConflict: "ip_hash" });

  return redirect(res, 302, WORKINK_STEP1);
}
