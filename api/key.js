import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { html, redirect } from "../lib/http.js";
import { generateKey, signState, verifyState } from "../lib/state.js";

const brandName = "ORIS";
const brandLogo = "https://i.postimg.cc/857FV3dy/e5201c96-07a3-491f-97c5-99354890190c.png";
const discordUrl = "https://discord.gg/vittel";

const flowTtlMs = 20 * 60 * 1000;
const tokenTtlMs = 20 * 60 * 1000;

function makeId(size = 24) {
  return crypto.randomBytes(size).toString("hex");
}

function hostBase(req) {
  const host = req.headers.host || "localhost:3000";
  return `https://${host}`;
}

function cookieDomain(host) {
  const raw = String(host || "").toLowerCase();
  if (raw.endsWith("sharkx.lol")) return ".sharkx.lol";
  return undefined;
}

function setHeaderCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge != null) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  parts.push(`Path=${options.path || "/"}`);

  const line = parts.join("; ");
  const previous = res.getHeader("Set-Cookie");
  const next = Array.isArray(previous) ? [...previous, line] : previous ? [previous, line] : [line];
  res.setHeader("Set-Cookie", next);
}

function getCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  raw.split(";").forEach((item) => {
    const [key, ...rest] = item.trim().split("=");
    if (!key) return;
    out[key] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

async function verifyWorkink(token, once = true) {
  if (!token) return null;

  const extra = once ? "?deleteToken=1" : "";
  const url = `https://work.ink/_api/v2/token/isValid/${encodeURIComponent(token)}${extra}`;

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    if (!data || data.valid !== true) return null;
    return data;
  } catch {
    return null;
  }
}

function pullToken(url) {
  return (
    (url.searchParams.get("wk") || "").trim() ||
    (url.searchParams.get("hash") || "").trim() ||
    (url.searchParams.get("t") || "").trim() ||
    (url.searchParams.get("token") || "").trim()
  );
}

function buildShell({ title, body, footer = true }) {
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
      --shadow:0 30px 90px rgba(0,0,0,.55);
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
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
      background:
        radial-gradient(900px 420px at 15% 20%, rgba(255,255,255,.06), transparent 60%),
        radial-gradient(700px 420px at 85% 75%, rgba(255,255,255,.04), transparent 60%),
        linear-gradient(180deg,#0b0b0d,#070709);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:28px 14px;
    }
    .frame{
      width:min(920px,100%);
      border:1px solid var(--line);
      border-radius:22px;
      box-shadow:var(--shadow);
      background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));
      overflow:hidden;
    }
    .topbar{
      display:flex;
      align-items:center;
      justify-content:flex-start;
      padding:16px 20px;
      border-bottom:1px solid var(--line);
      background:rgba(0,0,0,.35);
      backdrop-filter:blur(10px);
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
      grid-template-columns:1fr 340px;
      gap:18px;
      padding:18px;
    }
    @media (max-width:880px){
      .content{grid-template-columns:1fr}
    }
    .main,.side{
      background:rgba(0,0,0,.18);
      border:1px solid var(--line);
      border-radius:var(--radius);
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
      background:rgba(255,255,255,.03);
      border-radius:var(--radius2);
    }
    .num{
      width:28px;height:28px;border-radius:10px;
      border:1px solid var(--line2);
      display:flex;align-items:center;justify-content:center;
      color:rgba(255,255,255,.86);
      font-size:12px;font-weight:800;
      background:rgba(0,0,0,.30);
      flex:0 0 auto;
    }
    .step .txt{color:rgba(255,255,255,.78);font-size:13px;line-height:1.45;}
    .cta{margin-top:16px;}
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
      min-width:280px;
      background:var(--btn);
      color:var(--btnText);
      box-shadow:0 18px 50px rgba(0,0,0,.55);
      transition:transform .12s ease,filter .12s ease;
    }
    a.btn:hover{transform:translateY(-1px);filter:brightness(1.03);}
    .arrow{
      width:34px;height:34px;border-radius:12px;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,.10);
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
      border-radius:var(--radius2);
      padding:14px;
      background:rgba(255,255,255,.03);
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
      background:rgba(255,255,255,.10);
      overflow:hidden;
      border:1px solid rgba(255,255,255,.12);
    }
    .bar > div{
      height:100%;
      width:0%;
      background:rgba(255,255,255,.92);
      border-radius:999px;
      transition:width .25s ease;
    }
    .keyBox{
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.03);
      border-radius:var(--radius);
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
      font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
      font-size:16px;
      letter-spacing:.04em;
      word-break:break-all;
      color:rgba(255,255,255,.92);
    }
    .hint{margin-top:8px;color:rgba(255,255,255,.66);font-size:12px;line-height:1.5;}
    .bypass{
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.03);
      border-radius:var(--radius);
      padding:18px;
    }
    .bypass h2{margin:0 0 8px;font-size:18px;}
    .bypass p{margin:0 0 14px;color:rgba(255,255,255,.68);font-size:13px;line-height:1.55;}
    .foot{
      padding:14px 18px;
      border-top:1px solid var(--line);
      color:rgba(255,255,255,.60);
      font-size:12px;
      line-height:1.5;
      background:rgba(0,0,0,.30);
    }
    .foot a{color:#ffffff;text-decoration:underline;text-underline-offset:3px;}
  </style>
</head>
<body>
  <div class="frame">
    <div class="topbar">
      <div class="brand">
        <img src="${brandLogo}" alt="logo"/>
        <span>${brandName}</span>
      </div>
    </div>
    ${body}
    ${footer ? `
      <div class="foot">
        Do not open anything you downloaded from Work.ink, just download it and wait.
        Still no luck? Join our <a href="${discordUrl}" target="_blank" rel="noopener">Discord</a> server and we will try to assist you.
      </div>
    ` : ""}
  </div>
</body>
</html>`;
}

function screen({
  step,
  progressLabel,
  progressPct,
  title,
  subtitle,
  actionHref,
  actionText,
  showAction,
  showSteps,
  showKey,
  keyValue
}) {
  const stepsPart = showSteps
    ? `
      <p class="desc">${subtitle}</p>
      <div class="steps">
        <div class="step"><div class="num">1</div><div class="txt">Hit the button. Once you press Get my key, it will take you to Work.ink.</div></div>
        <div class="step"><div class="num">2</div><div class="txt">Finish the Work.ink step and you will be sent back to the ORIS key system automatically.</div></div>
        <div class="step"><div class="num">3</div><div class="txt">Then complete every step to receive your key.</div></div>
      </div>
    `
    : `<p class="desc">${subtitle}</p>`;

  return buildShell({
    title: "ORIS | Key System",
    body: `
      <div class="content">
        <div class="main">
          <h1>${title}</h1>
          ${stepsPart}
          ${showAction ? `
            <div class="cta">
              <a class="btn" href="${actionHref}">
                <span>${actionText}</span>
                <span class="arrow">→</span>
              </a>
            </div>
          ` : ""}
          ${showKey ? `
            <div class="keyBox">
              <div class="keyLabel">Your key</div>
              <div class="keyValue">${keyValue}</div>
              <div class="hint">Copy and paste it into your loader.</div>
            </div>
          ` : ""}
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
      </div>
    `
  });
}

function denied() {
  return buildShell({
    title: "ORIS | Blocked",
    body: `
      <div class="content">
        <div class="main">
          <div class="bypass">
            <h2>Access denied</h2>
            <p>The checkpoint validation failed. Start again from the beginning.</p>
            <div class="cta">
              <a class="btn" href="/key?step=0">
                <span>Restart key system</span>
                <span class="arrow">→</span>
              </a>
            </div>
          </div>
        </div>
        <div class="side">
          <div class="kicker">Security</div>
          <div class="progressBox">
            <div class="progressTop">
              <span>Protection</span>
              <span>ON</span>
            </div>
            <div class="bar"><div style="width:100%"></div></div>
          </div>
        </div>
      </div>
    `
  });
}

function flowCookieName(step) {
  return step === 1 ? "orx_s1" : "orx_s2";
}

async function createFlow(sb, req, step) {
  const id = makeId(18);
  const secret = makeId(18);
  const expiresAt = new Date(Date.now() + flowTtlMs).toISOString();

  const payload = {
    id,
    step,
    expiresAt
  };

  const signed = signState(payload);

  await sb.from("keyflow_sessions").insert([{
    id,
    step,
    ip_hash: sha256Hex(secret),
    ua_hash: sha256Hex(secret),
    expires_at: expiresAt
  }]);

  return { id, secret, signed };
}

async function readFlow(sb, id, step) {
  if (!id) return null;

  const { data, error } = await sb
    .from("keyflow_sessions")
    .select("*")
    .eq("id", id)
    .eq("step", step)
    .is("consumed_at", null)
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  if (new Date(row.expires_at) < new Date()) return null;

  return row;
}

async function closeFlow(sb, id) {
  const stamp = new Date().toISOString();
  await sb.from("keyflow_sessions").update({ consumed_at: stamp }).eq("id", id).is("consumed_at", null);
}

async function startCheckpoint(req, res, sb, step) {
  const workinkLink = step === 1
    ? process.env.WORKINK_STEP1_URL
    : process.env.WORKINK_STEP2_URL;

  const flow = await createFlow(sb, req, step);
  const domain = cookieDomain(req.headers.host);
  const name = flowCookieName(step);

  setHeaderCookie(res, name, flow.secret, {
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
    maxAge: flowTtlMs,
    ...(domain ? { domain } : {})
  });

  const callback = `${hostBase(req)}/key?step=${step}&f=${encodeURIComponent(flow.signed)}`;

  const target = workinkLink.includes("?")
    ? `${workinkLink}&r=${encodeURIComponent(callback)}`
    : `${workinkLink}?r=${encodeURIComponent(callback)}`;

  return redirect(res, 302, target);
}

function verifyFlowToken(raw, expectedStep) {
  const parsed = verifyState(raw);
  if (!parsed) return null;
  if (parsed.step !== expectedStep) return null;
  if (!parsed.id || !parsed.expiresAt) return null;
  if (new Date(parsed.expiresAt) < new Date()) return null;
  return parsed;
}

export default async function handler(req, res) {
  const sb = supabaseAdmin();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const stepRaw = parseInt(url.searchParams.get("step") || "0", 10);
  const step = Number.isFinite(stepRaw) ? Math.max(0, Math.min(2, stepRaw)) : 0;

  const workinkToken = pullToken(url);
  const flowState = (url.searchParams.get("f") || "").trim();
  const cookies = getCookies(req);
  const domain = cookieDomain(req.headers.host);

  if (step === 0) {
    return html(res, 200, screen({
      step: 0,
      progressLabel: "Step 0 / 2",
      progressPct: 0,
      title: "Get Key",
      subtitle: "",
      actionHref: "/key/goto-step1",
      actionText: "Get my key",
      showAction: true,
      showSteps: true,
      showKey: false,
      keyValue: ""
    }));
  }

  if (step === 1) {
    if (req.url.includes("/key/goto-step1")) {
      return startCheckpoint(req, res, sb, 1);
    }

    if (workinkToken && flowState) {
      const state = verifyFlowToken(flowState, 1);
      if (!state) return html(res, 200, denied());

      const row = await readFlow(sb, state.id, 1);
      if (!row) return html(res, 200, denied());

      const secret = cookies[flowCookieName(1)] || "";
      if (!secret) return html(res, 200, denied());
      if (row.ip_hash !== sha256Hex(secret)) return html(res, 200, denied());
      if (row.ua_hash !== sha256Hex(secret)) return html(res, 200, denied());

      const verified = await verifyWorkink(workinkToken, true);
      if (!verified) return html(res, 200, denied());

      await closeFlow(sb, row.id);

      setHeaderCookie(res, "orx_gate", signState({
        ok: true,
        at: Date.now(),
        exp: Date.now() + tokenTtlMs
      }), {
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
        maxAge: tokenTtlMs,
        ...(domain ? { domain } : {})
      });

      return redirect(res, 302, "/key?step=1");
    }

    const gate = verifyState(cookies.orx_gate || "");
    if (!gate || gate.ok !== true || gate.exp < Date.now()) {
      return html(res, 200, denied());
    }

    return html(res, 200, screen({
      step: 1,
      progressLabel: "Step 1 / 2",
      progressPct: 50,
      title: "Get Key",
      subtitle: "",
      actionHref: "/key/goto-step2",
      actionText: "Continue (Step 2)",
      showAction: true,
      showSteps: true,
      showKey: false,
      keyValue: ""
    }));
  }

  if (step === 2) {
    if (req.url.includes("/key/goto-step2")) {
      return startCheckpoint(req, res, sb, 2);
    }

    const gate = verifyState(cookies.orx_gate || "");
    if (!gate || gate.ok !== true || gate.exp < Date.now()) {
      return html(res, 200, denied());
    }

    if (!workinkToken || !flowState) {
      return html(res, 200, denied());
    }

    const state = verifyFlowToken(flowState, 2);
    if (!state) return html(res, 200, denied());

    const row = await readFlow(sb, state.id, 2);
    if (!row) return html(res, 200, denied());

    const secret = cookies[flowCookieName(2)] || "";
    if (!secret) return html(res, 200, denied());
    if (row.ip_hash !== sha256Hex(secret)) return html(res, 200, denied());
    if (row.ua_hash !== sha256Hex(secret)) return html(res, 200, denied());

    const verified = await verifyWorkink(workinkToken, true);
    if (!verified) return html(res, 200, denied());

    await closeFlow(sb, row.id);

    let finalKey = "";
    for (let i = 0; i < 12; i++) {
      finalKey = generateKey("ORIS");
      const { data, error } = await sb
        .from("keys")
        .select("id")
        .eq("key_value", finalKey)
        .limit(1);

      if (error) return html(res, 500, denied());
      if (!data || data.length === 0) break;
      finalKey = "";
    }

    if (!finalKey) return html(res, 500, denied());

    const { error: insertError } = await sb.from("keys").insert([{
      key_value: finalKey,
      duration_type: "1d"
    }]);

    if (insertError) return html(res, 500, denied());

    setHeaderCookie(res, "orx_gate", "0", {
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: 1,
      ...(domain ? { domain } : {})
    });

    setHeaderCookie(res, flowCookieName(1), "0", {
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: 1,
      ...(domain ? { domain } : {})
    });

    setHeaderCookie(res, flowCookieName(2), "0", {
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: 1,
      ...(domain ? { domain } : {})
    });

    return html(res, 200, screen({
      step: 2,
      progressLabel: "Step 2 / 2",
      progressPct: 100,
      title: "Key received",
      subtitle: "Your key is ready. Copy it and paste it into your loader.",
      actionHref: "",
      actionText: "",
      showAction: false,
      showSteps: false,
      showKey: true,
      keyValue: finalKey
    }));
  }

  return html(res, 400, denied());
}
