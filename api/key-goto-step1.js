import { redirect } from "../lib/http.js";
import { createState } from "../lib/state.js";

const WORKINK = process.env.WORKINK_STEP1_URL;

export default async function handler(req,res){

  const state = createState(1);

  return redirect(res,302,`${WORKINK}?state=${state}`);

}
