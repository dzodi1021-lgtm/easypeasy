import crypto from "crypto";

export function signState(obj) {
  const json = JSON.stringify(obj);
  const secret = process.env.SESSION_SECRET || "default_secret_change_me";
  const sig = crypto.createHmac("sha256", secret).update(json).digest("hex");
  return Buffer.from(json).toString("base64") + "." + sig;
}

export function verifyState(str) {
  if (!str) return null;
  const secret = process.env.SESSION_SECRET || "default_secret_change_me";
  const parts = str.split(".");
  if (parts.length !== 2) return null;
  try {
    const json = Buffer.from(parts[0], "base64").toString("utf8");
    const expected = crypto.createHmac("sha256", secret).update(json).digest("hex");
    if (expected !== parts[1]) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}