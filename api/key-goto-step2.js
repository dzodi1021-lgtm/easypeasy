async function verifyWorkink(token){

  if(!token) return false;

  const r = await fetch(`https://work.ink/_api/v2/token/isValid/${token}?deleteToken=1`);

  if(!r.ok) return false;

  const j = await r.json().catch(()=>null);

  return !!(j && j.valid);

}
