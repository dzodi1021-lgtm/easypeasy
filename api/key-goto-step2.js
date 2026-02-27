import { redirect } from "../lib/http.js";

const WORKINK_STEP2 = process.env.WORKINK_STEP2_URL || "https://work.ink/2kKN/step2";

export default async function handler(req, res) {
  return redirect(res, 302, WORKINK_STEP2);
}
