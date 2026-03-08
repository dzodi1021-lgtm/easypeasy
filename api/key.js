import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { html, redirect } from "../lib/http.js";

const APP_NAME = "ORIS";
const APP_LOGO = "https://i.postimg.cc/6Q1THhjb/1fb4e891fde837ae834dbb7b18a89bc1.webp";
const DISCORD_INVITE = "https://discord.gg/vittel";
const FLOW_TTL = 30 * 60 * 1000;

function part4() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[crypto.randomInt(0, chars.length)];
  return out;
}

function buildKey() {
  return `ORIS-${part4()}-${part4()}-${part4()}`;
}

function takeIp(req) {
  const xff = req.headers["x-forwarded-for"];
  let ip = "";

  if (typeof xff === "string" && xff.length) ip = xff.split(",")[0].trim();
  else if (Array.isArray(xff) && xff.length) ip = String(xff[0]).trim();
  else ip = String(req.socket?.remoteAddress || "");

  ip = ip.replace(/:\d+$/, "");
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);

  return ip || "unknown";
}

function digest(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function getBackToken(url) {
  return (
    (url.searchParams.get("wk") || "").trim() ||
    (url.searchParams.get("hash") || "").trim() ||
    (url.searchParams.get("t") || "").trim()
  );
}

function sameSourceIp(left, right) {
  const a = String(left || "").trim().replace(/^::ffff:/, "");
  const b = String(right || "").trim().replace(/^::ffff:/, "");
  return a === b;
}

async function checkWorkInk(token) {
  if (!token) return null;

  const endpoint = `https://work.ink/_api/v2/token/isValid/${encodeURIComponent(token)}?deleteToken=1`;

  try {
    const response = await fetch(endpoint, { method: "GET" });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    if (!data || data.valid !== true) return null;
    return data;
  } catch {
    return null;
  }
}

async function getRow(sb, ipHash) {
  const { data, error } = await sb
    .from("key_flows")
    .select("*")
    .eq("ip_hash", ipHash)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0];
}

async function saveRow(sb, ipHash, stage) {
  const expiresAt = new Date(Date.now() + FLOW_TTL).toISOString();

  await sb.from("key_flows").upsert([{
    ip_hash: ipHash,
    stage,
    expires_at: expiresAt,
    updated_at: new Date().toISOString()
  }], { onConflict: "ip_hash" });
}

async function dropRow(sb, ipHash) {
  await sb.from("key_flows").delete().eq("ip_hash", ipHash);
}

function shell({ title, inner, footer = true }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    :root{
      --bg:#0b0b0d;
      --line:rgba(255,255,255,.10);
      --line2:rgba(255,255,255,.18);
      --text:#f2f2f2;
      --muted:rgba(255,255,255,.62);
      --shadow: 0 30px 90px rgba(0,0,0,.55);
      --radius:18px;
      --radius2:14px;
      --btn:#f2f2f2;
      --btnText:#0b0b0d;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      color:var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      background:
        radial-gradient(900px 420px at 15% 20%, rgba(255,255,255,.06), transparent 60%),
        radial-gradient(700px 420px at 85% 75%, rgba(255,255,255,.04), transparent 60%),
        linear-gradient(180deg, #0b0b0d, #070709);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:28px 14px;
    }
    .frame{
      width:min(920px, 100%);
      border:1px solid var(--line);
      border-radius:22px;
      box-shadow: var(--shadow);
      background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
      overflow:hidden;
    }
    .topbar{
      display:flex;
      align-items:center;
      justify-content:flex-start;
      padding:16px 20px;
      border-bottom:1px solid var(--line);
      background: rgba(0,0,0,.35);
      backdrop-filter: blur(10px);
    }
    .brand{
      display:flex;
      align-items:center;
      gap:10px;
      letter-spacing:.16em;
      text-transform:uppercase;
      font-weight:800;
      font-size:13px;
    }
    .brand img{
      width:18px;height:18px;border-radius:6px;
      object-fit:cover;
      border:1px solid rgba(255,255,255,.16);
      background:#000;
    }
    .content{
      display:grid;
      grid-template-columns: 1fr 340px;
      gap:18px;
      padding:18px;
    }
    @media (max-width:880px){
      .content{grid-template-columns:1fr}
    }
    .main,.side{
      background: rgba(0,0,0,.18);
      border:1px solid var(--line);
      border-radius: var(--radius);
      padding:18px;
    }
    h1{
      margin:0 0 10px;
      font-size:44px;
      letter-spacing:-.02em;
      line-height:1.05;
    }
    .desc{
      margin:0 0 16px;
      color:var(--muted);
      font-size:14px;
      line-height:1.55;
      max-width:62ch;
    }
    .steps{display:flex;flex-direction:column;gap:10px;margin-top:10px;}
    .step{
      display:flex;gap:12px;padding:12px;
      border:1px solid var(--line);
      background: rgba(255,255,255,.03);
      border-radius: var(--radius2);
    }
    .num{
      width:28px;height:28px;border-radius:10px;
      border:1px solid var(--line2);
      display:flex;align-items:center;justify-content:center;
      color:rgba(255,255,255,.86);
      font-size:12px;font-weight:800;
      background: rgba(0,0,0,.30);
      flex:0 0 auto;
    }
    .step .txt{color:rgba(255,255,255,.78);font-size:13px;line-height:1.45;}
    .cta{ margin-top:16px; }
    a.btn{
      text-decoration:none;
      border-radius:16px;
      padding:14px 16px;
      font-weight:900;
      letter-spacing:.02em;
      font-size:14px;
      display:inline-flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      min-width: 280px;
      background: var(--btn);
      color: var(--btnText);
      box-shadow: 0 18px 50px rgba(0,0,0,.55);
      transition: transform .12s ease, filter .12s ease;
    }
    a.btn:hover{ transform: translateY(-1px); filter: brightness(1.03); }
    .arrow{
      width:34px;height:34px;border-radius:12px;
      display:flex;align-items:center;justify-content:center;
      background: rgba(0,0,0,.10);
    }
    .kicker{
      font-size:12px;
      letter-spacing:.18em;
      text-transform:uppercase;
      color:var(--muted);
      margin-bottom:10px;
    }
    .progressBox{
      border:1px solid var(--line);
      border-radius: var(--radius2);
      padding:14px;
      background: rgba(255,255,255,.03);
    }
    .progressTop{
      display:flex;
      justify-content:space-between;
      align-items:center;
      font-size:12px;
      color:var(--muted);
      margin-bottom:10px;
      letter-spacing:.10em;
      text-transform:uppercase;
    }
    .bar{
      height:10px;
      border-radius:999px;
      background: rgba(255,255,255,.10);
      overflow:hidden;
      border:1px solid rgba(255,255,255,.12);
    }
    .bar > div{
      height:100%;
      width:0%;
      background: rgba(255,255,255,.92);
      border-radius:999px;
      transition: width .25s ease;
    }
    .keyBox{
      border:1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.03);
      border-radius: var(--radius);
      padding:14px;
      margin-top:14px;
    }
    .keyLabel{
      font-size:12px;
      color:var(--muted);
      letter-spacing:.18em;
      text-transform:uppercase;
      margin-bottom:8px;
    }
    .keyValue{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size:16px;
      letter-spacing:.04em;
      word-break:break-all;
      color: rgba(255,255,255,.92);
    }
    .hint{margin-top:8px;color: rgba(255,255,255,.66);font-size:12px;line-height:1.5;}
    .bypass{
      border:1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.03);
      border-radius: var(--radius);
      padding:18px;
    }
    .bypass h2{ margin:0 0 8px; font-size:18px; }
    .bypass p{ margin:0 0 14px; color: rgba(255,255,255,.68); font-size:13px; line-height:1.55; }
    .foot{
      padding:14px 18px;
      border-top:1px solid var(--line);
      color: rgba(255,255,255,.60);
      font-size:12px;
      line-height:1.5;
      background: rgba(0,0,0,.30);
    }
    .foot a{ color:#ffffff; text-decoration:underline; text-underline-offset:3px; }
  </style>
</head>
<body>
  <div class="frame">
    <div class="topbar">
      <div class="brand">
        <img src="${APP_LOGO}" alt="logo"/>
        <span>${APP_NAME}</span>
      </div>
    </div>

    ${inner}

    ${footer ? `
      <div class="foot">
        Dont open anything you donwloaded from the workink, just download it and wait.
        Still no luck? Join our <a href="${DISCORD_INVITE}" target="_blank" rel="noopener">Discord</a> server and we will try to assist you.
      </div>
    ` : ""}
  </div>
</body>
</html>`;
}

function screen({
  step,
  progressPct,
  progressLabel,
  title,
  subtitle,
  showButton,
  buttonHref,
  buttonText,
  showKey,
  keyValue,
  showSteps
}) {
  const guide = showSteps ? `
    <p class="desc">${subtitle}</p>
    <div class="steps">
      <div class="step"><div class="num">1</div><div class="txt">Hit the button 1 Once you press Get my key it'll take you to workink.</div></div>
      <div class="step"><div class="num">2</div><div class="txt">Finish the workink and you get sent back to Oris key system automatically</div></div>
      <div class="step"><div class="num">3</div><div class="txt">Then do all steps (there are 2) to get your key</div></div>
    </div>
  ` : `<p class="desc">${subtitle}</p>`;

  const inner = `
  <div class="content">
    <div class="main">
      <h1>${title}</h1>

      ${guide}

      ${showButton ? `
        <div class="cta">
          <a class="btn" href="${buttonHref}">
            <span>${buttonText}</span>
            <span class="arrow">→</span>
          </a>
        </div>
      ` : ``}

      ${showKey ? `
        <div class="keyBox">
          <div class="keyLabel">Your key</div>
          <div class="keyValue">${keyValue}</div>
          <div class="hint">Copy & paste it into your Roblox UI.</div>
        </div>
      ` : ``}
    </div>

    <div class="side">
      <div class="kicker">Status</div>
      <div class="progressBox">
        <div class="progressTop">
          <span>${progressLabel}</span>
          <span>${progressPct}%</span>
        </div>
        <div class="bar"><div style="width:${progressPct}%"></div></div>
      </div>
    </div>
  </div>`;

  return shell({ title: "ORIS | Key System", inner });
}

function Bypass() {
  const inner = `
  <div class="content">
    <div class="main">
      <div class="bypass">
        <h2>Access denied</h2>
        <p>You failed your attempt to bypass the key system. Please restart from the beginning.</p>
        <div class="cta">
          <a class="btn" href="/key?step=0"><span>Restart key system</span><span class="arrow">→</span></a>
        </div>
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

  return shell({ title: "ORIS | Blocked", inner });
}

export default async function handler(req, res) {
  const sb = supabaseAdmin();
  const url = new URL(req.url, `https://${req.headers.host}`);

  const stepParam = url.searchParams.get("step") || "0";
  const token = getBackToken(url);

  let step = parseInt(stepParam, 10);
  if (Number.isNaN(step) || step < 0) step = 0;
  if (step > 2) step = 2;

  const visitorIp = takeIp(req);
  const visitorHash = digest(visitorIp);

  if (step === 0) {
    return html(res, 200, screen({
      step: 0,
      progressPct: 0,
      progressLabel: "Step 0 / 2",
      title: "Get Key",
      subtitle: "",
      showSteps: true,
      showButton: true,
      buttonText: "Get my key",
      buttonHref: "/key/goto-step1",
      showKey: false,
      keyValue: ""
    }));
  }

  if (step === 1) {
    if (token) {
      const checked = await checkWorkInk(token);
      if (!checked) return html(res, 200, Bypass());

      const info = checked.info || {};

      if (process.env.WORKINK_STEP1_LINK_ID && String(info.linkId) !== String(process.env.WORKINK_STEP1_LINK_ID)) {
        return html(res, 200, Bypass());
      }

      if (!sameSourceIp(visitorIp, info.byIp)) {
        return html(res, 200, Bypass());
      }

      await saveRow(sb, visitorHash, 1);
      return redirect(res, 302, "/key?step=1");
    }

    const flow = await getRow(sb, visitorHash);
    if (!flow || flow.stage !== 1 || new Date(flow.expires_at) < new Date()) {
      return html(res, 200, Bypass());
    }

    return html(res, 200, screen({
      step: 1,
      progressPct: 50,
      progressLabel: "Step 1 / 2",
      title: "Get Key",
      subtitle: "",
      showSteps: true,
      showButton: true,
      buttonText: "Continue (Step 2)",
      buttonHref: "/key/goto-step2",
      showKey: false,
      keyValue: ""
    }));
  }

  if (step === 2) {
    const flow = await getRow(sb, visitorHash);
    if (!flow || flow.stage !== 1 || new Date(flow.expires_at) < new Date()) {
      return html(res, 200, Bypass());
    }

    if (!token) {
      return html(res, 200, Bypass());
    }

    const checked = await checkWorkInk(token);
    if (!checked) return html(res, 200, Bypass());

    const info = checked.info || {};

    if (process.env.WORKINK_STEP2_LINK_ID && String(info.linkId) !== String(process.env.WORKINK_STEP2_LINK_ID)) {
      return html(res, 200, Bypass());
    }

    if (!sameSourceIp(visitorIp, info.byIp)) {
      return html(res, 200, Bypass());
    }

    let finalKey = "";
    for (let i = 0; i < 10; i++) {
      finalKey = buildKey();

      const { data, error } = await sb
        .from("keys")
        .select("id")
        .eq("key_value", finalKey)
        .limit(1);

      if (error) return html(res, 500, Bypass());
      if (!data || data.length === 0) break;
      finalKey = "";
    }

    if (!finalKey) return html(res, 500, Bypass());

    const { error } = await sb
      .from("keys")
      .insert([{ key_value: finalKey, duration_type: "1d" }]);

    if (error) return html(res, 500, Bypass());

    await dropRow(sb, visitorHash);

    return html(res, 200, screen({
      step: 2,
      progressPct: 100,
      progressLabel: "Step 2 / 2",
      title: "Key received",
      subtitle: "Your key is ready. Copy it and paste it into your Roblox UI.",
      showSteps: false,
      showButton: false,
      buttonText: "",
      buttonHref: "#",
      showKey: true,
      keyValue: finalKey
    }));
  }

  return html(res, 400, "Invalid step");
}
