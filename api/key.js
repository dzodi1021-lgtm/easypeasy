import { supabaseAdmin } from "../lib/supabase.js";
import { html, redirect, parseCookies, setCookie, randomToken } from "../lib/http.js";
import crypto from "crypto";
import { verifyWorkinkToken, getClientIp, getUserAgent, sha256Hex } from "../lib/workink.js";
import { signState, verifyState } from "../lib/state.js";

function renderBypassError() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Key system error</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#e5e7eb;font-family:system-ui,sans-serif;">
  <div style="background:#020617;border-radius:18px;border:1px solid rgba(248,113,113,.6);padding:24px;max-width:420px;width:90%;box-shadow:0 22px 60px rgba(0,0,0,.8);text-align:center;">
    <h2 style="margin:0 0 8px;font-size:20px;color:#fecaca;">Oops!</h2>
    <p style="margin:0 0 10px;font-size:14px;color:#fca5a5;">You failed your attempt to bypass the key system.</p>
    <p style="margin:0 0 18px;font-size:13px;color:#9ca3af;">Please restart from the beginning.</p>
    <a href="/key?step=0" style="display:inline-block;padding:8px 14px;border-radius:999px;border:1px solid rgba(248,113,113,.8);background:rgba(248,113,113,.12);color:#fecaca;font-size:13px;text-decoration:none;">Restart key system</a>
  </div>
</body></html>`;
}

function renderStepPage(opts) {
  const step = opts.step;
  const title = opts.title;
  const subtitle = opts.subtitle;
  const buttonText = opts.buttonText || "";
  const buttonHref = opts.buttonHref || "#";
  const showButton = !!buttonText;
  const showKey = !!opts.showKey;
  const keyValue = opts.keyValue || "";
  let pct = 0, label = "Step 0 / 2";
  if (step === 1) { pct = 50; label = "Step 1 / 2"; }
  else if (step === 2) { pct = 100; label = "Step 2 / 2"; }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Key system</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#020617,#0f172a);color:#e5e7eb;font-family:system-ui,sans-serif;">
  <div style="background:#020617;border-radius:20px;border:1px solid rgba(30,64,175,.7);padding:22px 20px;max-width:460px;width:92%;box-shadow:0 30px 80px rgba(0,0,0,.9);">
    <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;margin-bottom:10px;">Key System</div>
    <div style="margin-bottom:16px;">
      <div style="font-size:17px;font-weight:700;color:#f9fafb;">${title}</div>
      <div style="font-size:13px;color:#9ca3af;">${subtitle}</div>
    </div>
    <div style="margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#9ca3af;margin-bottom:6px;"><span>${label}</span><span>${pct}%</span></div>
      <div style="height:8px;border-radius:999px;background:#0f172a;overflow:hidden;border:1px solid #1e293b;">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#22c55e,#4ade80);transition:width .25s ease;"></div>
      </div>
    </div>
    ${showKey ? `<div style="margin-bottom:14px;padding:10px 12px;border-radius:12px;border:1px solid rgba(34,197,94,.7);background:rgba(34,197,94,.08);"><div style="font-size:12px;color:#bbf7d0;">Your key</div><div style="font-size:16px;font-weight:700;color:#bbf7d0;word-break:break-all;">${keyValue}</div><div style="font-size:11px;color:#86efac;margin-top:4px;">Copy and paste in the Roblox UI.</div></div>` : ""}
    ${showButton ? `<div style="margin-top:8px;"><a href="${buttonHref}" style="display:inline-flex;align-items:center;justify-content:center;padding:9px 16px;border-radius:999px;background:linear-gradient(135deg,#22c55e,#4ade80);color:#020617;font-size:14px;font-weight:600;text-decoration:none;">${buttonText}</a><div style="margin-top:8px;font-size:11px;color:#9ca3af;">Complete the offer, then you will be redirected.</div></div>` : ""}
  </div>
</body></html>`;
}

function getStrictFingerprint(req) {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  return {
    ipHash: sha256Hex(ip),
    uaHash: sha256Hex(ua),
  };
}

export default async function handler(req, res) {
  const sb = supabaseAdmin();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const stepParam = url.searchParams.get("step") || "0";
  const wk = (url.searchParams.get("wk") || "").trim();

  let step = parseInt(stepParam, 10);
  if (isNaN(step) || step < 0) step = 0;
  if (step > 2) step = 2;

  const cookies = parseCookies(req);
  const stateCookie = cookies.keyflow;
  const state = stateCookie ? verifyState(stateCookie) : null;

  const nonceCookie = (cookies.kfn || "").toString();

  let stage = -1;
  let nonceHash = "";
  let boundIpHash = "";
  let boundUaHash = "";

  if (state && typeof state.stage === "number") {
    stage = state.stage;
    nonceHash = (state.nonceHash || "").toString();
    boundIpHash = (state.ipHash || "").toString();
    boundUaHash = (state.uaHash || "").toString();
  }

  // STEP 0
  if (step === 0) {
    const nonce = randomToken(18);
    const nHash = sha256Hex(nonce);

    setCookie(res, "kfn", nonce, {
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: 3600000,
      domain: ".sharkx.lol" // ✅ partage www/non-www
    });

    setCookie(res, "keyflow", signState({ stage: 0, nonceHash: nHash }), {
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: 3600000,
      domain: ".sharkx.lol" // ✅ partage www/non-www
    });

    return html(res, 200, renderStepPage({
      step: 0,
      title: "Complete Step 1",
      subtitle: "Finish the first Work.ink step to unlock the next stage.",
      buttonText: "Start Step 1",
      buttonHref: "/key/goto-step1",
      showKey: false
    }));
  }

  // STEP 1
  if (step === 1) {
    if (wk) {
      if (stage !== 0) return html(res, 200, renderBypassError());
      if (!nonceCookie || !nonceHash) return html(res, 200, renderBypassError());
      if (sha256Hex(nonceCookie) !== nonceHash) return html(res, 200, renderBypassError());

      const expectedLinkId = process.env.WORKINK_STEP1_LINK_ID || "";
      const v = await verifyWorkinkToken({ token: wk, expectedLinkId, req, deleteToken: true });
      if (!v.ok) return html(res, 200, renderBypassError());

      const fp = getStrictFingerprint(req);

      setCookie(res, "keyflow", signState({
        stage: 1,
        nonceHash,
        ipHash: fp.ipHash,
        uaHash: fp.uaHash
      }), {
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
        maxAge: 3600000,
        domain: ".sharkx.lol" // ✅ partage www/non-www
      });

      return redirect(res, 302, "/key?step=1");
    }

    if (stage !== 1) return html(res, 200, renderBypassError());
    if (!nonceCookie || !nonceHash) return html(res, 200, renderBypassError());
    if (sha256Hex(nonceCookie) !== nonceHash) return html(res, 200, renderBypassError());

    return html(res, 200, renderStepPage({
      step: 1,
      title: "Step 1 completed",
      subtitle: "Now complete Step 2 to obtain your key.",
      buttonText: "Start Step 2",
      buttonHref: "/key/goto-step2",
      showKey: false
    }));
  }

  // STEP 2
  if (step === 2) {
    if (stage !== 1) return html(res, 200, renderBypassError());
    if (!wk) return html(res, 200, renderBypassError());

    if (!nonceCookie || !nonceHash) return html(res, 200, renderBypassError());
    if (sha256Hex(nonceCookie) !== nonceHash) return html(res, 200, renderBypassError());

    const fp = getStrictFingerprint(req);
    if (!boundIpHash || !boundUaHash) return html(res, 200, renderBypassError());
    if (fp.ipHash !== boundIpHash) return html(res, 200, renderBypassError());
    if (fp.uaHash !== boundUaHash) return html(res, 200, renderBypassError());

    const expectedLinkId = process.env.WORKINK_STEP2_LINK_ID || "";
    const v = await verifyWorkinkToken({ token: wk, expectedLinkId, req, deleteToken: true });
    if (!v.ok) return html(res, 200, renderBypassError());

    const duration_type = "1d";
    const keyValue = crypto.randomBytes(12).toString("hex");

    const { error: ierr } = await sb
      .from("keys")
      .insert([{ key_value: keyValue, duration_type }]);
    if (ierr) return html(res, 500, renderBypassError());

    // reset
    setCookie(res, "kfn", "", {
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: 1,
      domain: ".sharkx.lol" // ✅
    });
    setCookie(res, "keyflow", signState({ stage: -1 }), {
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: 3600000,
      domain: ".sharkx.lol" // ✅
    });

    return html(res, 200, renderStepPage({
      step: 2,
      title: "Key generated",
      subtitle: "Copy this key and paste it inside the Roblox UI.",
      showKey: true,
      keyValue
    }));
  }

  return html(res, 400, "Invalid step");
}
