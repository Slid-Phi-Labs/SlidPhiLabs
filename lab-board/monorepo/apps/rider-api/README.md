# @slidphi/rider-api

> GID starter README (0.1.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What @slidphi/rider-api does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Entry point: `index.mjs` (re-exports `lab-board/identity/ed25519.mjs`).

```js
import { issueIdentity, verifyIdentity } from "./index.mjs";

const id = issueIdentity({ agent_id: "rider-api" });
// { body: "<base64url>", sig: "<base64url>", public_key: "<base64url>" }

verifyIdentity(id).ok; // true
verifyIdentity({ ...id, sig: id.sig.slice(0, -2) + "AA" }).reason;
// "bad_signature"
```

Run the suite: `npm test` (`node --test test.mjs`, 2 pass).

## Testing

How to run the suite and what it covers.

## License

Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc Commercial License. See the LICENSE files at the owning project root.
