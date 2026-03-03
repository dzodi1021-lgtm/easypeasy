import { serialize } from "cookie";

// En-tête `html`
export function html(res, status, htmlString) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(htmlString);
}

// Redirection HTTP
export function redirect(res, status, target) {
  res.writeHead(status, { Location: target });
  res.end();
}

// Parse les cookies de la requête
export function parseCookies(req) {
  const header = req.headers.cookie || "";
  const result = {};
  header.split(";").forEach(pair => {
    const [name, ...rest] = pair.trim().split("=");
    if (!name) return;
    result[name] = decodeURIComponent(rest.join("="));
  });
  return result;
}

// Définit un cookie dans la réponse, options supportées (Domain, Secure, HttpOnly, SameSite, etc.)
export function setCookie(res, name, value, options = {}) {
  const cookieStr = serialize(name, value, options);
  const prev = res.getHeader("Set-Cookie");
  let updated = cookieStr;
  if (prev) {
    // Gère cas multiple cookies
    if (Array.isArray(prev)) {
      updated = prev.concat(cookieStr);
    } else {
      updated = [prev, cookieStr];
    }
  }
  res.setHeader("Set-Cookie", updated);
}
