# @slidphi/lab-identity

> GID starter README (0.1.0). Ed25519 agent identity issuer + verifier.

## Usage

Entry point: `ed25519.mjs`. Issues time-boxed identity tokens
(`{ agent_id, exp, alg }` + Ed25519 signature + SPKI public key).

```js
import { issueIdentity, verifyIdentity } from "./ed25519.mjs";

const id = issueIdentity({ agent_id: "lab-seat" });
verifyIdentity(id); // { ok: true, claims: { agent_id, exp, alg: "Ed25519" } }
verifyIdentity({ ...id, sig: "AA" + id.sig.slice(2) });
// { ok: false, reason: "bad_signature" }
```

Expired tokens refuse with `expired`. Run the suite: `npm test`
(`node --test ed25519.test.mjs`, 2 pass).

## License

Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc Commercial License. See the LICENSE files at the owning project root.
