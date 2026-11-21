import { createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";

export function issueIdentity({ agent_id, ttl_seconds = 900 } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const exp = Math.floor(Date.now() / 1000) + ttl_seconds;
  const body = Buffer.from(JSON.stringify({ agent_id, exp, alg: "Ed25519" }));
  const sig = sign(null, body, privateKey);
  return {
    body: body.toString("base64url"),
    sig: sig.toString("base64url"),
    public_key: publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
  };
}

export function verifyIdentity(token) {
  const body = Buffer.from(token.body, "base64url");
  const key = createPublicKey({ key: Buffer.from(token.public_key, "base64url"), type: "spki", format: "der" });
  const ok = verify(null, body, key, Buffer.from(token.sig, "base64url"));
  if (!ok) return { ok: false, reason: "bad_signature" };
  const claims = JSON.parse(body.toString());
  if (claims.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
  return { ok: true, claims };
}
