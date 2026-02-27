import { supabaseAdmin } from "../lib/supabase.js";
import { redirect, randomToken } from "../lib/http.js";

const BASE_URL = process.env.BASE_URL || "http://sharkx.lol";
const WORKINK_STEP2 = process.env.WORKINK_STEP2_URL || "https://work.ink/2kKN/step2";
const TOKEN_TTL_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
  const sb = supabaseAdmin();

  const token = randomToken(16);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await sb.from("keyflow_tokens").insert([{
    token,
    step: 2,
    expires_at: expiresAt
  }]);

  const redirectUrl = `${BASE_URL}/key?step=2&t=${token}`;
  const workinkUrl = WORKINK_STEP2.includes("?")
    ? `${WORKINK_STEP2}&redirect=${encodeURIComponent(redirectUrl)}`
    : `${WORKINK_STEP2}?redirect=${encodeURIComponent(redirectUrl)}`;

  return redirect(res, 302, workinkUrl);

}
