import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { html, redirect, parseCookies, setCookie } from "../lib/http.js";
import { generateKey } from "../lib/state.js";

// --- Helpers ---
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
    return parts.length >= 3
      ? `${parts[0]}.${parts[1]}.${parts[2]}`
      : ip;
  }
  const hextets = ip.split(":").filter(Boolean);
  return hextets.slice(0, 4).join(":") || ip;
}
function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}
function cookieDomainFor(host) {
  const h = (host || "").toLowerCase();
  return h.endsWith("sharkx.lol") ? ".sharkx.lol" : undefined;
}

async function verifyWorkinkToken(token) {
  if (!token) return false;
  const resp = await fetch(`https://work.ink/_api/v2/token/isValid/${encodeURIComponent(token)}?deleteToken=1`);
  if (!resp.ok) return false;
  const data = await resp.json().catch(() => null);
  return !!(data && data.valid);
}

// --- UI Layout (identique au design précédent) ---
const BRAND_NAME = "VITTEL";
const BRAND_LOGO_URL = "https://i.postimg.cc/6Q1THhjb/1fb4e891fde837ae834dbb7b18a89bc1.webp";
const DISCORD_URL = "https://discord.gg/vittel";

function layoutPage({ title, inner, footer = true }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title><style>
    /* (Styles omis pour brièveté, identiques à l’UI fournie) */
    body{margin:0;color:#f2f2f2;...}
    /* ... (le CSS complet de layoutPage) ... */
  </style></head><body>
  <div class="frame">
    <div class="topbar"><div class="brand">
      <img src="${BRAND_LOGO_URL}" alt="logo"/><span>${BRAND_NAME}</span>
    </div></div>
    ${inner}
    ${footer?`<div class="foot">
      Dont open anything you downloaded from Work.ink, just wait. Still no luck? 
      Join our <a href="${DISCORD_URL}" target="_blank">Discord</a>.
    </div>`:""}
  </div></body></html>`;
}

function renderKeySystem({ step, progressPct, progressLabel, title, subtitle,
                           showButton, buttonHref, buttonText, showKey, keyValue, showSteps }) {
  const stepsHtml = showSteps ? `
    <p class="desc">${subtitle}</p>
    <div class="steps">
      <div class="step"><div class="num">1</div><div class="txt">
        Hit the button. Once you press "Get my key", it takes you to Work.ink.
      </div></div>
      <div class="step"><div class="num">2</div><div class="txt">
        Finish the Work.ink step; you'll be returned here automatically.
      </div></div>
      <div class="step"><div class="num">3</div><div class="txt">
        Complete the remaining steps to get your key.
      </div></div>
    </div>` : `<p class="desc">${subtitle}</p>`;

  const inner = `<div class="content">
    <div class="main">
      <h1>${title}</h1>
      ${stepsHtml}
      ${showButton ? `<div class="cta"><a class="btn" href="${buttonHref}">
        <span>${buttonText}</span><span class="arrow">→</span>
      </a></div>` : ""}
      ${showKey ? `<div class="keyBox"><div class="keyLabel">Your key</div>
        <div class="keyValue">${keyValue}</div>
        <div class="hint">Copy & paste it into your Roblox UI.</div>
      </div>` : ""}
    </div>
    <div class="side">
      <div class="kicker">Status</div>
      <div class="progressBox"><div class="progressTop">
        <span>${progressLabel}</span><span>${progressPct}%</span>
      </div><div class="bar"><div style="width:${progressPct}%"></div></div></div>
    </div>
  </div>`;

  return layoutPage({ title: "VITTEL | Key System", inner });
}

function renderBypass() {
  const inner = `<div class="content">
    <div class="main">
      <div class="bypass">
        <h2>Access denied</h2>
        <p>Bypass detected. Restart from the beginning.</p>
        <div class="cta"><a class="btn" href="/key?step=0">
          <span>Restart key system</span><span class="arrow">→</span>
        </a></div>
      </div>
    </div>
    <div class="side">
      <div class="kicker">Security</div>
      <div class="progressBox"><div class="progressTop">
        <span>Protection</span><span>ON</span>
      </div><div class="bar"><div style="width:100%"></div></div></div>
    </div>
  </div>`;
  return layoutPage({ title: "VITTEL | Blocked", inner });
}

// --- Endpoint logique principale ---
export default async function handler(req, res) {
  const sb = supabaseAdmin();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const step = Math.max(0, Math.min(2, parseInt(url.searchParams.get("step")||"0", 10)));
  const sid = (url.searchParams.get("sid") || "").trim();
  const wk = (url.searchParams.get("wk") || url.searchParams.get("hash") || url.searchParams.get("t") || "").trim();
  const cookies = parseCookies(req);
  const prog = cookies.kf_prog || "";
  const domain = cookieDomainFor(req.headers.host);

  if (step === 0) {
    // Step 0: page d'intro
    return html(res, 200, renderKeySystem({
      step: 0, progressPct: 0, progressLabel: "Step 0 / 2", 
      title: "Get Key", subtitle: "",
      showSteps: true, showButton: true,
      buttonText: "Get my key", buttonHref: "/key/goto-step1",
      showKey: false, keyValue: ""
    }));
  }

  if (step === 1) {
    // Retour Work.ink (token présent)
    if (wk) {
      const { data: session } = await sb.from("keyflow_sessions").select("*")
                                      .eq("id", sid).single();
      if (!session || session.step !== 1 || session.consumed_at) {
        return html(res, 200, renderBypass());
      }
      if (new Date(session.expires_at) < new Date()) {
        return html(res, 200, renderBypass());
      }
      const ip = ipPrefix(getClientIp(req));
      const ua = req.headers["user-agent"]||"";
      if (session.ip_hash !== sha256Hex(ip) || session.ua_hash !== sha256Hex(ua)) {
        return html(res, 200, renderBypass());
      }
      if (!await verifyWorkinkToken(wk)) {
        return html(res, 200, renderBypass());
      }
      await sb.from("keyflow_sessions").update({ consumed_at: new Date().toISOString() })
              .eq("id", sid);
      setCookie(res, "kf_prog", "1", {
        httpOnly: true, sameSite: "Lax", secure: true,
        maxAge: 6*60*60*1000, domain
      });
      return redirect(res, 302, "/key?step=1");
    }
    // Pas de token : si pas de prog, on bloque.
    if (prog !== "1") {
      return html(res, 200, renderBypass());
    }
    return html(res, 200, renderKeySystem({
      step: 1, progressPct: 50, progressLabel: "Step 1 / 2",
      title: "Get Key", subtitle: "",
      showSteps: true, showButton: true,
      buttonText: "Continue (Step 2)", buttonHref: "/key/goto-step2",
      showKey: false, keyValue: ""
    }));
  }

  if (step === 2) {
    // Doit avoir validé step1
    if (prog !== "1") {
      return html(res, 200, renderBypass());
    }
    // Retour Work.ink étape 2 (token requis)
    if (!wk) {
      return html(res, 200, renderBypass());
    }
    const { data: session } = await sb.from("keyflow_sessions").select("*")
                                    .eq("id", sid).single();
    if (!session || session.step !== 2 || session.consumed_at) {
      return html(res, 200, renderBypass());
    }
    if (new Date(session.expires_at) < new Date()) {
      return html(res, 200, renderBypass());
    }
    const ip = ipPrefix(getClientIp(req));
    const ua = req.headers["user-agent"]||"";
    if (session.ip_hash !== sha256Hex(ip) || session.ua_hash !== sha256Hex(ua)) {
      return html(res, 200, renderBypass());
    }
    if (!await verifyWorkinkToken(wk)) {
      return html(res, 200, renderBypass());
    }
    await sb.from("keyflow_sessions").update({ consumed_at: new Date().toISOString() })
            .eq("id", sid);

    // Générer et insérer la clé
    let keyValue = "";
    for (let i = 0; i < 10; i++) {
      keyValue = generateKey();
      const { data: exists } = await sb.from("keys").select("id")
                                      .eq("key_value", keyValue).limit(1);
      if (!exists.length) break;
      keyValue = "";
    }
    if (!keyValue) {
      return html(res, 500, renderBypass());
    }
    const { error: ierr } = await sb.from("keys")
         .insert([{ key_value: keyValue, duration_type: "1d" }]);
    if (ierr) {
      return html(res, 500, renderBypass());
    }
    setCookie(res, "kf_prog", "0", {
      httpOnly: true, sameSite: "Lax", secure: true,
      maxAge: 1, domain
    });
    return html(res, 200, renderKeySystem({
      step: 2, progressPct: 100, progressLabel: "Step 2 / 2",
      title: "Key reçu", subtitle: "Votre clé est prête.",
      showSteps: false, showButton: false,
      showKey: true, keyValue
    }));
  }

  // étape invalide
  return html(res, 400, "<h2>Invalid step</h2>");
}
