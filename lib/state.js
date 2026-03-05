import crypto from "crypto";

const SECRET = process.env.STATE_SECRET || "change_this_secret";

function sign(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

export function createState(step) {
  const payload = {
    step,
    nonce: crypto.randomBytes(16).toString("hex"),
    ts: Date.now()
  };

  const json = JSON.stringify(payload);
  const sig = sign(json);

  return Buffer.from(json).toString("base64url") + "." + sig;
}

export function readState(token) {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  try {
    const json = Buffer.from(parts[0], "base64url").toString("utf8");

    if (sign(json) !== parts[1]) return null;

    const data = JSON.parse(json);

    if (Date.now() - data.ts > 1000 * 60 * 15) return null;

    return data;
  } catch {
    return null;
  }
}
