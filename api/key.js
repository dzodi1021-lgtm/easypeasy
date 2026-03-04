import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { html, redirect, parseCookies, setCookie } from "../lib/http.js";

/* -------------------- KEY FORMAT -------------------- */
function randomBlock4() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[crypto.randomInt(0, chars.length)];
  return out;
}
function generateVittelKey() {
  return `VITTEL-${randomBlock4()}-${randomBlock4()}-${randomBlock4()}`;
}

/* -------------------- UTILITAIRES -------------------- */
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
function ipPrefix(ip) {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : ip;
  }
  const hextets = ip.split(":").filter(Boolean);
  return hextets.slice(0, 4).join(":") || ip;
}
function getUserAgent(req) {
  return req.headers["user-agent"] || "";
}
function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}
function cookieDomainFor(host) {
  const h = (host||"").toLowerCase();
  return h.endsWith("sharkx.lol") ? ".sharkx.lol" : undefined;
}

/* -------------------- WORK.INK VERIFY -------------------- */
async function verifyWorkinkToken(token) {
  if (!token) return false;
  const resp = await fetch(`https://work.ink/_api/v2/token/isValid/${encodeURIComponent(token)}?deleteToken=1`);
  if (!resp.ok) return false;
  const data = await resp.json().catch(()=>null);
  return !!(data && data.valid);
}

/* -------------------- UI (layout noir original) -------------------- */
const BRAND_NAME = "VITTEL";
const BRAND_LOGO_URL = "https://i.postimg.cc/6Q1THhjb/1fb4e891fde837ae834dbb7b18a89bc1.webp";
const DISCORD_URL = "https://discord.gg/vittel";

function layoutPage({ title, inner, footer=true }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title><style>
    /* (styles omis pour brevité, identiques à l’UI originale fournie) */
  </style></head><body>
    <div class="frame">
      <div class="topbar">
        <div class="brand">
          <img src="${BRAND_LOGO_URL}" alt="logo"/>
          <span>${BRAND_NAME}</span>
        </div>
      </div>
      ${inner}
      ${footer ? `
        <div class="foot">
          Dont open anything you downloaded from the workink, just download it and wait.
          Still no luck? Join our <a href="${DISCORD_URL}" target="_blank" rel="noopener">Discord</a>.
        </div>
      ` : ""}
    </div>
  </body></html>`;
}

function renderKeySystem({ step, progressPct, progressLabel, title, subtitle, showButton, buttonHref, buttonText, showKey, keyValue, showSteps }) {
  const stepsBlock = showSteps ? `
    <p class="desc">${subtitle}</p>
    <div class="steps">
      <div class="step"><div class="num">1</div><div class="txt">Hit the button 1 once you press it, it redirects to Work.ink.</div></div>
      <div class="step"><div class="num">2</div><div class="txt">Finish on Work.ink and return to the key system automatically.</div></div>
      <div class="step"><div class="num">3</div><div class="txt">Perform all steps (there are 2) to get your key.</div></div>
    </div>` : `<p class="desc">${subtitle}</p>`;

  const inner = `<div class="content">
    <div class="main">
      <h1>${title}</h1>
      ${stepsBlock}
      ${showButton ? `<div class="cta"><a class="btn" href="${buttonHref}"><span>${buttonText}</span><span class="arrow">→</span></a></div>` : ""}
      ${showKey ? `<div class="keyBox"><div class="keyLabel">Your key</div><div class="keyValue">${keyValue}</div><div class="hint">Copy & paste it into your Roblox UI.</div></div>` : ""}
    </div>
    <div class="side">
      <div class="kicker">Status</div>
      <div class="progressBox">
        <div class="progressTop"><span>${progressLabel}</span><span>${progressPct}%</span></div>
        <div class="bar"><div style="width:${progressPct}%"></div></div>
      </div>
    </div>
  </div>`;
  return layoutPage({ title: "VITTEL | Key System", inner });
}

function renderBypass() {
  const inner = `<div class="content">
    <div class="main">
      <div class="bypass">
        <h2>Access denied</h2>
        <p>You failed your attempt to bypass the key system. Please restart from the beginning.</p>
        <div class="cta"><a class="btn" href="/key?step=0"><span>Restart key system</span><span class="arrow">→</span></a></div>
      </div>
    </div>
    <div class="side">
      <div class="kicker">Security</div>
      <div class="progressBox">
        <div class="progressTop"><span>Protection</span><span>ON</span></div>
        <div class="bar"><div style="width:100%"></div></div>
      </div>
    </div>
  </div>`;
  return layoutPage({ title: "VITTEL | Blocked", inner });
}

function getReturnedToken(url) {
  const wk   = (url.searchParams.get("wk")   || "").trim();
  const hash = (url.searchParams.get("hash") || "").trim();
  const t    = (url.searchParams.get("t")    || "").trim();
  return wk || hash || t;
}

export default async function handler(req, res) {
  const sb = supabaseAdmin();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const stepParam = url.searchParams.get("step") || "0";
  const sid = (url.searchParams.get("sid") || "").trim();
  const wk  = getReturnedToken(url);

  let step = parseInt(stepParam, 10);
  if (isNaN(step) || step < 0) step = 0;
  if (step > 2) step = 2;

  const cookies = parseCookies(req);
  const prog = cookies.kf_prog || ""; // "1" après step1 validé
  const domain = cookieDomainFor(req.headers.host);

  // STEP 0 : page initiale
  if (step === 0) {
    return html(res, 200, renderKeySystem({
      step: 0, progressPct: 0, progressLabel: "Step 0 / 2",
      title: "Get Key", subtitle: "",
      showSteps: true,
      showButton: true, buttonHref: "/key/goto-step1", buttonText: "Get my key",
      showKey: false, keyValue: ""
    }));
  }

  // STEP 1
  if (step === 1) {
    if (wk) {
      // Retour de Work.ink : valide wk + sid + session step1
      const session = await sb.from("keyflow_sessions").select("*").eq("id", sid).single();
      if (!session || session.step !== 1) return html(res, 200, renderBypass());
      if (session.consumed_at) return html(res, 200, renderBypass());
      if (new Date(session.expires_at) < new Date()) return html(res, 200, renderBypass());

      const ip = ipPrefix(getClientIp(req));
      const ua = getUserAgent(req);
      if (session.ip_hash !== sha256Hex(ip) || session.ua_hash !== sha256Hex(ua))
        return html(res, 200, renderBypass());

      const okWk = await verifyWorkinkToken(wk);
      if (!okWk) return html(res, 200, renderBypass());

      await sb.from("keyflow_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", sid);

      // Cookie marque step1 validé
      setCookie(res, "kf_prog", "1", {
        httpOnly: true, sameSite: "Lax", secure: true,
        maxAge: 6*60*60*1000,
        domain
      });
      return redirect(res, 302, "/key?step=1");
    }

    // Direct GET /key?step=1 sans wk
    if (prog !== "1") return html(res, 200, renderBypass());
    return html(res, 200, renderKeySystem({
      step: 1, progressPct: 50, progressLabel: "Step 1 / 2",
      title: "Get Key", subtitle: "",
      showSteps: true, showButton: true,
      buttonHref: "/key/goto-step2", buttonText: "Continue (Step 2)",
      showKey: false, keyValue: ""
    }));
  }

  // STEP 2
  if (step === 2) {
    if (prog !== "1") return html(res, 200, renderBypass());  // step1 must have succeeded
    if (!wk) return html(res, 200, renderBypass());

    const session = await sb.from("keyflow_sessions").select("*").eq("id", sid).single();
    if (!session || session.step !== 2) return html(res, 200, renderBypass());
    if (session.consumed_at) return html(res, 200, renderBypass());
    if (new Date(session.expires_at) < new Date()) return html(res, 200, renderBypass());

    const ip = ipPrefix(getClientIp(req));
    const ua = getUserAgent(req);
    if (session.ip_hash !== sha256Hex(ip) || session.ua_hash !== sha256Hex(ua))
      return html(res, 200, renderBypass());

    const okWk = await verifyWorkinkToken(wk);
    if (!okWk) return html(res, 200, renderBypass());

    await sb.from("keyflow_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", sid);

    // Générer la clé finale
    let keyValue = "";
    for (let tries = 0; tries < 10; tries++) {
      keyValue = generateVittelKey();
      const { data: exists } = await sb.from("keys")
        .select("id").eq("key_value", keyValue).limit(1);
      if (!exists.length) break;
      keyValue = "";
    }
    if (!keyValue) return html(res, 500, renderBypass());
    await sb.from("keys").insert([{ key_value: keyValue, duration_type: "1d" }]);

    // Reset cookie prog
    setCookie(res, "kf_prog", "0", { httpOnly:true, secure:true, sameSite:"Lax", maxAge:1, domain });

    return html(res, 200, renderKeySystem({
      step: 2, progressPct: 100, progressLabel: "Step 2 / 2",
      title: "Key received", subtitle: "Your key is ready. Copy it into your Roblox UI.",
      showSteps: false, showButton: false, showKey: true, keyValue
    }));
  }

  return html(res, 400, "Invalid step");
}
