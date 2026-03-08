import crypto from "crypto";

export function signState(data, secret) {
  const h = crypto.createHmac("sha256", secret);
  h.update(data);
  return `${data}.${h.digest("hex")}`;
}

export function verifyState(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [data, hash] = parts;
  const h = crypto.createHmac("sha256", secret);
  h.update(data);
  return h.digest("hex") === hash ? data : false;
}

function block4() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}

export function generateKey(prefix = "VITTEL") {
  const p = String(prefix).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${p}-${block4()}-${block4()}-${block4()}`;
}
