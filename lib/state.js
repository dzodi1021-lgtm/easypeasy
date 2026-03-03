import crypto from "crypto";
const SECRET = process.env.STATE_SECRET || "insecure_default";

// Convertit objet -> base64 + HMAC
export function signState(obj) {
  const json = JSON.stringify(obj);
  const hash = crypto.createHmac("sha256", SECRET).update(json).digest("hex");
  return Buffer.from(json).toString("base64") + "." + hash;
}

// Vérifie et récupère l'objet (ou retourne null)
export function verifyState(token) {
  try {
    const [b64, hash] = token.split(".");
    const json = Buffer.from(b64, "base64").toString("utf8");
    const expected = crypto.createHmac("sha256", SECRET).update(json).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}
