# cuni

> GID starter README (0.1.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What cuni does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Entry point: `index.mjs` (re-exports `./silent-rules.mjs`).

```js
import { silentErrors } from "./index.mjs";

silentErrors("const price = 19.99");
// [{ rule: "money-float",
//    detail: "A money field uses a decimal literal without bigint, Decimal, or cents." }]

silentErrors("const priceCents = 1999");
// []
```

Run the suite: `npm test` (`node --test silent-rules.test.mjs`).

## Testing

How to run the suite and what it covers.

## License

Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc Commercial License. See the LICENSE files at the owning project root.
