import crypto from "crypto";

/**
 * Récupère une IP "stable" côté Vercel (best effort).
 */
export function getClientIp(req) {
  const xff = (req.headers["x-forwarded-for"] || "").toString();
  if (xff) return xff.split(",")[0].trim();
  const xrip = (req.headers["x-real-ip"] || "").toString().trim();
  if (xrip) return xrip;
  return (req.socket?.remoteAddress || "").toString();
}

export function getUserAgent(req) {
  return (req.headers["user-agent"] || "").toString();
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input || ""), "utf8").digest("hex");
}

/**
 * Vérifie un token Work.ink via leur endpoint officiel.
 * - deleteToken=1 => single-use (empêche le partage)
 * - compare linkId si fourni en env
 * - compare byIp si possible (anti partage / anti bypass)
 */
export async function verifyWorkinkToken({ token, expectedLinkId, req, deleteToken = true }) {
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "missing_token" };
  }

  const base = `https://work.ink/_api/v2/token/isValid/${encodeURIComponent(token)}`;
  const url = deleteToken ? `${base}?deleteToken=1` : base;

  let data;
  try {
    const r = await fetch(url, { method: "GET" });
    data = await r.json().catch(() => null);
  } catch {
    return { ok: false, reason: "workink_unreachable" };
  }

  if (!data || data.valid !== true || !data.info) {
    return { ok: false, reason: "invalid_token" };
  }

  // Optionnel : vérifier que le token vient du bon lien
  if (expectedLinkId != null && expectedLinkId !== "") {
    const exp = Number(expectedLinkId);
    if (Number.isFinite(exp) && Number(data.info.linkId) !== exp) {
      return { ok: false, reason: "wrong_link" };
    }
  }

  // Optionnel : vérifier IP (si Work.ink donne byIp)
  const byIp = (data.info.byIp || "").toString().trim();
  const clientIp = getClientIp(req);
  if (byIp && clientIp && byIp !== clientIp) {
    return { ok: false, reason: "ip_mismatch" };
  }

  return { ok: true, info: data.info };
}

/**
 * Invalidation auto des sessions admin si tu changes les credentials.
 */
export function credentialsSignature() {
  const u = process.env.ADMIN_USERNAME || "admin";
  const p = process.env.ADMIN_PASSWORD || "change_me";
  const secret = process.env.SESSION_SECRET || "default_secret_change_me";
  return crypto.createHmac("sha256", secret).update(`${u}:${p}`).digest("hex");
}
