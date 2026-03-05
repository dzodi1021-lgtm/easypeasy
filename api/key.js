import { supabaseAdmin } from "../lib/supabase.js";
import { html, redirect, parseCookies, setCookie } from "../lib/http.js";
import { generateKey } from "../lib/state.js"; // optional helper for key format

async function verifyToken(token) {
  if (!token) return false;
  const resp = await fetch(`https://work.ink/_api/v2/token/isValid/${encodeURIComponent(token)}?deleteToken=1`);
  if (!resp.ok) return false;
  const data = await resp.json().catch(() => null);
  return !!(data && data.valid);
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  let ip = "";
  if (typeof xff === "string" && xff) ip = xff.split(",")[0].trim();
  else if (Array.isArray(xff) && xff.length) ip = String(xff[0]).trim();
  else ip = req.socket.remoteAddress || "";
  ip = ip.replace(/:\d+$/, "");
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip || "unknown";
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

function cookieDomainFor(host) {
  const h = (host || "").toLowerCase();
  return h.endsWith("example.com") ? ".example.com" : undefined;
}

function layoutPage(title, innerHtml, showFooter = true) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title><style>
    /* (CSS styles for dark UI, identical to the previous design) */
    body{margin:0;color:#f2f2f2;background:#0b0b0d;display:flex;justify-content:center;
      align-items:center;height:100vh;font-family:Arial,sans-serif;}
    .frame{width:90%;max-width:800px;border:1px solid rgba(255,255,255,0.1);border-radius:16px;
      background:rgba(255,255,255,0.05);box-shadow:0 20px 60px rgba(0,0,0,0.5);}
    .topbar{padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);
      background:rgba(0,0,0,0.2);font-weight:bold;}
    .content{padding:20px;}
    .btn{display:inline-block;padding:12px 20px;margin-top:20px;
      background:#f2f2f2;color:#0b0b0d;font-weight:bold;text-decoration:none;border-radius:8px;}
    .progress{width:100%;background:rgba(255,255,255,0.1);border-radius:8px;margin-top:20px;}
    .bar{height:10px;width:0%;background:#f2f2f2;border-radius:8px;transition:width 0.3s;}
    .key-box{margin-top:20px;padding:10px;border:1px solid rgba(255,255,255,0.2);
      border-radius:8px;background:rgba(0,0,0,0.2);font-family:monospace;}
  </style></head><body>
  <div class="frame">
    <div class="topbar">VITTEL Key System</div>
    ${innerHtml}
    ${showFooter ? `<div class="content" style="font-size:12px;color:rgba(255,255,255,0.6);">
      Download only from Work.ink. No one will email you the key.
     </div>` : ""}
  </div></body></html>`;
}

export default async function handler(req, res) {
  const sb = supabaseAdmin();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const cookies = parseCookies(req);
  const prog = cookies.kf_prog || "";
  const domain = cookieDomainFor(req.headers.host);
  let step = parseInt(url.searchParams.get("step") || "0", 10);
  if (isNaN(step) || step < 0) step = 0;
  if (step > 2) step = 2;
  const sid = (url.searchParams.get("sid") || "").trim();
  const token = (url.searchParams.get("wk") || url.searchParams.get("hash") || url.searchParams.get("t") || "").trim();

  // Step 0: show entry page
  if (step === 0) {
    const htmlPage = layoutPage("VITTEL Key", `
      <div class="content">
        <p>Click the button to start the Key system.</p>
        <a class="btn" href="/key/goto-step1">Get my key</a>
      </div>
    `);
    res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(htmlPage);
    return;
  }

  // Step 1
  if (step === 1) {
    if (token) {
      const { data: session } = await sb.from("keyflow_sessions").select("*").eq("id", sid).single();
      if (!session || session.step !== 1 || session.consumed_at) {
        const denyPage = layoutPage("Access Denied", `<div class="content"><h2>Access denied</h2></div>`, false);
        res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(denyPage); return;
      }
      if (new Date(session.expires_at) < new Date()) {
        res.statusCode = 200; res.setHeader("Content-Type", "text/html"); res.end(layoutPage("Expired","<div class=\"content\"><h2>Session expired</h2></div>",false));
        return;
      }
      const ip = ipPrefix(getClientIp(req));
      const ua = getUserAgent(req);
      if (session.ip_hash !== sha256Hex(ip) || session.ua_hash !== sha256Hex(ua)) {
        res.statusCode = 200; res.setHeader("Content-Type", "text/html"); res.end(layoutPage("Mismatch","<div class=\"content\"><h2>IP/UA mismatch</h2></div>",false));
        return;
      }
      if (!await verifyToken(token)) {
        const htmlPage = layoutPage("Access Denied", `<div class="content"><h2>Invalid token</h2></div>`, false);
        res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(htmlPage);
        return;
      }
      await sb.from("keyflow_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", sid);
      setCookie(res, "kf_prog", "1", {
        httpOnly: true, sameSite: "Lax", secure: true, maxAge: 3600, domain
      });
      return redirect(res, 302, "/key?step=1");
    }
    // No token in URL
    if (prog !== "1") {
      const denyPage = layoutPage("Access Denied", `<div class="content"><h2>Access denied</h2></div>`, false);
      res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(denyPage); return;
    }
    const htmlPage = layoutPage("VITTEL Key (Step 1)", `
      <div class="content">
        <p>Step 1 complete. Click to continue to Step 2.</p>
        <a class="btn" href="/key/goto-step2">Continue (Step 2)</a>
        <div class="progress"><div class="bar" style="width:50%"></div></div>
      </div>
    `);
    res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(htmlPage);
    return;
  }

  // Step 2
  if (step === 2) {
    if (prog !== "1") {
      const denyPage = layoutPage("Access Denied", `<div class="content"><h2>Access denied</h2></div>`, false);
      res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(denyPage); return;
    }
    if (!token) {
      const denyPage = layoutPage("Access Denied", `<div class="content"><h2>No token</h2></div>`, false);
      res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(denyPage); return;
    }
    const { data: session } = await sb.from("keyflow_sessions").select("*").eq("id", sid).single();
    if (!session || session.step !== 2 || session.consumed_at) {
      const denyPage = layoutPage("Access Denied", `<div class="content"><h2>Access denied</h2></div>`, false);
      res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(denyPage); return;
    }
    if (new Date(session.expires_at) < new Date()) {
      res.statusCode = 200; res.setHeader("Content-Type", "text/html"); res.end(layoutPage("Expired","<div class=\"content\"><h2>Session expired</h2></div>",false));
      return;
    }
    const ip = ipPrefix(getClientIp(req));
    const ua = getUserAgent(req);
    if (session.ip_hash !== sha256Hex(ip) || session.ua_hash !== sha256Hex(ua)) {
      res.statusCode = 200; res.setHeader("Content-Type", "text/html"); res.end(layoutPage("Mismatch","<div class=\"content\"><h2>IP/UA mismatch</h2></div>",false));
      return;
    }
    if (!await verifyToken(token)) {
      const htmlPage = layoutPage("Access Denied", `<div class="content"><h2>Invalid token</h2></div>`, false);
      res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(htmlPage);
      return;
    }
    await sb.from("keyflow_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", sid);

    // Generate unique key
    let keyValue = "";
    for (let i = 0; i < 10; i++) {
      keyValue = crypto.randomBytes(2).toString("hex").toUpperCase();
      keyValue = `VITTEL-${keyValue}-${keyValue}-${keyValue}`;
      const { data: exists } = await sb.from("keys").select("id").eq("key_value", keyValue).limit(1);
      if (!exists.length) break;
      keyValue = "";
    }
    if (!keyValue) {
      const errPage = layoutPage("Error", `<div class="content"><h2>Error generating key</h2></div>`, false);
      res.statusCode = 500; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(errPage);
      return;
    }
    await sb.from("keys").insert([{ key_value: keyValue, duration_type: "1d" }]);
    setCookie(res, "kf_prog", "0", { httpOnly: true, sameSite: "Lax", secure: true, maxAge: 1, domain });

    const htmlPage = layoutPage("VITTEL Key (Step 2)", `
      <div class="content">
        <p>Your key is ready:</p>
        <div class="key-box">${keyValue}</div>
        <div class="progress"><div class="bar" style="width:100%"></div></div>
      </div>
    `);
    res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(htmlPage);
    return;
  }

  // Invalid step
  res.statusCode = 400;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(layoutPage("Error", `<div class="content"><h2>Invalid step</h2></div>`, false));
}

