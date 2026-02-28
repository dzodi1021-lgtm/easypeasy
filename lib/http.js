import crypto from "crypto";

export function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

export function html(res, status, content) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(content);
}

export function redirect(res, status, location) {
  res.statusCode = status;
  res.setHeader("Location", location);
  res.end();
}

export function parseCookies(req) {
  const h = req.headers.cookie || "";
  const out = {};
  h.split(";").forEach(part => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

export function setCookie(res, name, value, opts = {}) {
  const parts = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);

  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`); // ✅ important pour www/non-www
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");

  parts.push(`Path=${opts.path || "/"}`);

  const prev = res.getHeader("Set-Cookie");
  const next = Array.isArray(prev)
    ? prev.concat(parts.join("; "))
    : prev
      ? [prev, parts.join("; ")]
      : [parts.join("; ")];

  res.setHeader("Set-Cookie", next);
}

export function requireMethod(req, res, method) {
  if (req.method !== method) {
    json(res, 405, { ok: false, message: "Method not allowed" });
    return false;
  }
  return true;
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}
