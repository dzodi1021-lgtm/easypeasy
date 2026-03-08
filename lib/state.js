import crypto from "crypto";

export function signState(value) {
  const raw = JSON.stringify(value);
  const secret = process.env.SESSION_SECRET || "default_secret_change_me";
  const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return `${Buffer.from(raw).toString("base64")}.${sig}`;
}

export function verifyState(input) {
  if (!input) return null;

  const secret = process.env.SESSION_SECRET || "default_secret_change_me";
  const parts = String(input).split(".");
  if (parts.length !== 2) return null;

  try {
    const raw = Buffer.from(parts[0], "base64").toString("utf8");
    const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (sig !== parts[1]) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function segment() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return out;
}

export function generateKey(prefix = "ORIS") {
  const head = String(prefix || "ORIS")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return `${head}-${segment()}-${segment()}-${segment()}`;
}
