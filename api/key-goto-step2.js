import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { redirect } from "../lib/http.js";

const WORKINK_STEP2 = process.env.WORKINK_STEP2_URL || "https://work.ink/2kKN/step2";

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

  const { data, error } = await sb
    .from("key_flows")
    .select("*")
    .eq("ip_hash", ipHash)
    .limit(1);

  if (error || !data || data.length === 0) {
    return redirect(res, 302, "/key?step=0");
  }

  const row = data[0];
  if (row.stage !== 1) {
    return redirect(res, 302, "/key?step=0");
  }

  if (new Date(row.expires_at) < new Date()) {
    await sb.from("key_flows").delete().eq("ip_hash", ipHash);
    return redirect(res, 302, "/key?step=0");
  }

  return redirect(res, 302, WORKINK_STEP2);
}
