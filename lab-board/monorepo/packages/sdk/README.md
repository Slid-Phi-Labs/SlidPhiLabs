# @slidphi/sdk

> GID starter README (0.1.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What @slidphi/sdk does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Entry point: `index.mjs`. Re-exports the lab identity issuer and the
CuNi silent-error rules.

```js
import { issueIdentity, verifyIdentity, silentErrors } from "./index.mjs";

verifyIdentity(issueIdentity({ agent_id: "lab" })).ok; // true
silentErrors("const price = 1.25").map((row) => row.rule);
// ["money-float"]
```

Run the suite: `npm test` (`node --test sdk.test.mjs`, 3 pass).

## Testing

How to run the suite and what it covers.

## License

Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc Commercial License. See the LICENSE files at the owning project root.
