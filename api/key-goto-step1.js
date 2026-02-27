import { redirect } from "../lib/http.js";

const WORKINK_STEP1 = process.env.WORKINK_STEP1_URL || "https://work.ink/2kKN/step1";

export default async function handler(req, res) {
  return redirect(res, 302, WORKINK_STEP1);
}
