# @slidphi/cuni-api

> GID starter README (0.1.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What @slidphi/cuni-api does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Entry point: `index.mjs` (re-exports `lab-board/cuni/silent-rules.mjs`,
the shared CuNi silent-error rules).

```js
import { silentErrors } from "./index.mjs";

silentErrors("const price = 1.5").map((row) => row.rule);
// ["money-float"]
```

Run the suite: `npm test` (`node --test test.mjs`).

## Testing

How to run the suite and what it covers.

## License

Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc Commercial License. See the LICENSE files at the owning project root.
