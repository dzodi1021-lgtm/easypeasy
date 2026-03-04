import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { html, redirect, parseCookies, setCookie } from "../lib/http.js";

// Génération d'une clé aléatoire VITTEL
function randomBlock4() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[crypto.randomInt(0, chars.length)];
  return out;
}
function generateVittelKey() {
  return `VITTEL-${randomBlock4()}-${randomBlock4()}-${randomBlock4()}`;
}

// Fonctions utilitaires
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

// Vérification du token Work.ink
async function verifyWorkinkToken(token) {
  if (!token) return false;
  const resp = await fetch(`https://work.ink/_api/v2/token/isValid/${encodeURIComponent(token)}?deleteToken=1`);
  if (!resp.ok) return false;
  const data = await resp.json().catch(()=>null);
  return !!(data && data.valid);
}

// UI layout (styles omis pour clarté, identique à l'UI d'origine en noir)
const BRAND_NAME = "VITTEL";
const BRAND_LOGO_URL = "https://i.postimg.cc/6Q1THhjb/1fb4e891fde837ae834dbb7b18a89bc1.webp";
const DISCORD_URL = "https://discord.gg/vittel";
function layoutPage({ title, inner, footer=true }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title><style>
    /* (styles complets récupérés de l’UI d’origine) */
    :root{--bg:#0b0b0d;--line:rgba(255,255,255,.10);--line2:rgba(255,255,255,.18);--text:#f2f2f2;--muted:rgba(255,255,255,.62);
    --shadow:0 30px 90px rgba(0,0,0,.55);--radius:18px;--radius2:14px;--btn:#f2f2f2;--btnText:#0b0b0d;}
    *{box-sizing:border-box}html,body{height:100%}body{margin:0;color:var(--text);
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
      background:radial-gradient(900px 420px at 15% 20%,rgba(255,255,255,.06),transparent 60%),
                 radial-gradient(700px 420px at 85% 75%,rgba(255,255,255,.04),transparent 60%),
                 linear-gradient(180deg,#0b0b0d,#070709);
      display:flex;align-items:center;justify-content:center;padding:28px 14px;}
    .frame{width:min(920px,100%);border:1px solid var(--line);border-radius:22px;
      box-shadow:var(--shadow);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));overflow:hidden;}
    .topbar{display:flex;align-items:center;justify-content:flex-start;padding:16px 20px;
      border-bottom:1px solid var(--line);background:rgba(0,0,0,.35);backdrop-filter:blur(10px);}
    .brand{display:flex;align-items:center;gap:10px;letter-spacing:.16em;text-transform:uppercase;
      font-weight:800;font-size:13px;}
    .brand img{width:18px;height:18px;border-radius:6px;object-fit:cover;border:1px solid rgba(255,255,255,.16);background:#000;}
    .content{display:grid;grid-template-columns:1fr 340px;gap:18px;padding:18px;}
    @media (max-width:880px){.content{grid-template-columns:1fr}}
    .main,.side{background:rgba(0,0,0,.18);border:1px solid var(--line);
      border-radius:var(--radius);padding:18px;}
    h1{margin:0 0 10px;font-size:44px;letter-spacing:-.02em;line-height:1.05;}
    .desc{margin:0 0 16px;color:var(--muted);font-size:14px;line-height:1.55;max-width:62ch;}
    .steps{display:flex;flex-direction:column;gap:10px;margin-top:10px;}
    .step{display:flex;gap:12px;padding:12px;border:1px solid var(--line);
      background:rgba(255,255,255,.03);border-radius:var(--radius2);}
    .num{width:28px;height:28px;border-radius:10px;border:1px solid var(--line2);
      display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.86);
      font-size:12px;font-weight:800;background:rgba(0,0,0,.30);flex:0 0 auto;}
    .step .txt{color:rgba(255,255,255,.78);font-size:13px;line-height:1.45;}
    .cta{margin-top:16px;}
    a.btn{text-decoration:none;border-radius:16px;padding:14px 16px;font-weight:900;
      letter-spacing:.02em;font-size:14px;display:inline-flex;align-items:center;
      justify-content:space-between;gap:12px;min-width:280px;background:var(--btn);
      color:var(--btnText);box-shadow:0 18px 50px rgba(0,0,0,.55);
      transition:transform .12s ease, filter .12s ease;}
    a.btn:hover{transform:translateY(-1px);filter:brightness(1.03);}
    .arrow{width:34px;height:34px;border-radius:12px;display:flex;
      align-items:center;justify-content:center;background:rgba(0,0,0,.10);}
    .kicker{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);
      margin-bottom:10px;}
    .progressBox{border:1px solid var(--line);border-radius:var(--radius2);
      padding:14px;background:rgba(255,255,255,.03);}
    .progressTop{display:flex;justify-content:space-between;align-items:center;
      font-size:12px;color:var(--muted);margin-bottom:10px;letter-spacing:.10em;
      text-transform:uppercase;}
    .bar{height:10px;border-radius:999px;background:rgba(255,255,255,.10);
      overflow:hidden;border:1px solid rgba(255,255,255,.12);}
    .bar>div{height:100%;width:0%;background:rgba(255,255,255,.92);
      border-radius:999px;transition:width .25s ease;}
    .keyBox{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.03);
      border-radius:var(--radius);padding:14px;margin-top:14px;}
    .keyLabel{font-size:12px;color:var(--muted);letter-spacing:.18em;
      text-transform:uppercase;margin-bottom:8px;}
    .keyValue{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,
      "Liberation Mono","Courier New",monospace;font-size:16px;letter-spacing:.04em;
      word-break:break-all;color:rgba(255,255,255,.92);}
    .hint{margin-top:8px;color:rgba(255,255,255,.66);font-size:12px;line-height:1.5;}
    .bypass{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);
      border-radius:var(--radius);padding:18px;}
    .bypass h2{margin:0 0 8px;font-size:18px;}
    .bypass p{margin:0 0 14px;color:rgba(255,255,255,.68);font-size:13px;line-height:1.55;}
    .foot{padding:14px 18px;border-top:1px solid var(--line);color:rgba(255,255,255,.60);
      font-size:12px;line-height:1.5;background:rgba(0,0,0,.30);}
    .foot a{text-decoration:underline;text-underline-offset:3px;}
  </style></head><body>
  <div class="frame">
    <div class="topbar"><div class="brand">
      <img src="${BRAND_LOGO_URL}" alt="logo"/><span>${BRAND_NAME}</span>
    </div></div>
    ${inner}
    ${footer ? `
      <div class="foot">
        Dont open anything you downloaded from the workink, just download it and wait.
        Still no luck? Join our <a href="${DISCORD_URL}" target="_blank">Discord</a>.
      </div>
    ` : ""}
  </div></body></html>`;
}

function renderKeySystem({ step, progressPct, progressLabel, title, subtitle, showButton, buttonHref, buttonText, showKey, keyValue, showSteps }) {
  const stepsBlock = showSteps ? `
    <p class="desc">${subtitle}</p>
    <div class="steps">
      <div class="step"><div class="num">1</div><div class="txt">Hit the button 1 once you press it, it'll take you to Work.ink.</div></div>
      <div class="step"><div class="num">2</div><div class="txt">Finish on Work.ink and get sent back automatically.</div></div>
      <div class="step"><div class="num">3</div><div class="txt">Then all steps (there are 2) get your key.</div></div>
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
      <div class="bypass"><h2>Access denied</h2><p>You failed to bypass. Restart.</p>
        <div class="cta"><a class="btn" href="/key?step=0"><span>Restart</span><span class="arrow">→</span></a></div></div>
    </div>
    <div class="side">
      <div class="kicker">Security</div>
      <div class="progressBox"><div class="progressTop"><span>Protection</span><span>ON</span></div>
      <div class="bar"><div style="width:100%"></div></div></div>
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
  let step = parseInt(url.searchParams.get("step")||"0", 10);
  if (isNaN(step)||step<0) step = 0;
  if (step>2) step = 2;
  const sid = (url.searchParams.get("sid")||"").trim();
  const wk  = getReturnedToken(url);

  const cookies = parseCookies(req);
  const prog = cookies.kf_prog || "";
  const domain = cookieDomainFor(req.headers.host);

  // Step 0
  if (step === 0) {
    return html(res, 200, renderKeySystem({
      step: 0, progressPct:0, progressLabel:"Step 0 / 2", title:"Get Key", subtitle:"",
      showSteps:true, showButton:true, buttonHref:"/key/goto-step1", buttonText:"Get my key",
      showKey:false, keyValue:""
    }));
  }

  // Step 1
  if (step === 1) {
    if (wk) {
      const session = await sb.from("keyflow_sessions").select("*").eq("id", sid).single();
      if (!session || session.step !== 1 || session.consumed_at) return html(res,200,renderBypass());
      if (new Date(session.expires_at) < new Date()) return html(res,200,renderBypass());
      const ip = ipPrefix(getClientIp(req)), ua = getUserAgent(req);
      if (session.ip_hash !== sha256Hex(ip) || session.ua_hash !== sha256Hex(ua))
        return html(res,200,renderBypass());
      if (!await verifyWorkinkToken(wk)) return html(res,200,renderBypass());
      await sb.from("keyflow_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", sid);
      setCookie(res, "kf_prog", "1", { httpOnly:true, sameSite:"Lax", secure:true, maxAge:6*60*60*1000, domain });
      return redirect(res, 302, "/key?step=1");
    }
    // direct access without wk
    if (prog !== "1") return html(res,200,renderBypass());
    return html(res, 200, renderKeySystem({
      step: 1, progressPct:50, progressLabel:"Step 1 / 2", title:"Get Key", subtitle:"",
      showSteps:true, showButton:true, buttonHref:"/key/goto-step2", buttonText:"Continue (Step 2)",
      showKey:false, keyValue:""
    }));
  }

  // Step 2
  if (step === 2) {
    if (prog !== "1") return html(res,200,renderBypass());
    if (!wk) return html(res,200,renderBypass());
    const session = await sb.from("keyflow_sessions").select("*").eq("id", sid).single();
    if (!session || session.step !== 2 || session.consumed_at) return html(res,200,renderBypass());
    if (new Date(session.expires_at) < new Date()) return html(res,200,renderBypass());
    const ip = ipPrefix(getClientIp(req)), ua = getUserAgent(req);
    if (session.ip_hash !== sha256Hex(ip) || session.ua_hash !== sha256Hex(ua))
      return html(res,200,renderBypass());
    if (!await verifyWorkinkToken(wk)) return html(res,200,renderBypass());
    await sb.from("keyflow_sessions").update({ consumed_at: new Date().toISOString() }).eq("id", sid);

    // Génération de la clé finale
    let keyValue = "";
    for (let i = 0; i < 10; i++) {
      keyValue = generateVittelKey();
      const { data: exists } = await sb.from("keys").select("id").eq("key_value", keyValue).limit(1);
      if (!exists.length) break;
      keyValue = "";
    }
    if (!keyValue) return html(res,500,renderBypass());
    await sb.from("keys").insert([{ key_value: keyValue, duration_type: "1d" }]);

    setCookie(res, "kf_prog", "0", { httpOnly:true, sameSite:"Lax", secure:true, maxAge:1, domain });
    return html(res, 200, renderKeySystem({
      step: 2, progressPct:100, progressLabel:"Step 2 / 2",
      title:"Key received", subtitle:"Your key is ready.", 
      showSteps:false, showButton:false, showKey:true, keyValue
    }));
  }

  return html(res, 400, "Invalid step");
}
