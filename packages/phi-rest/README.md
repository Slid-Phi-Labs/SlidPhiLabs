# @slidphi/phi-rest

> GID starter README (0.1.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What @slidphi/phi-rest does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Entry point: `src/phi_rest.mjs` (also `src/phi_rest.cjs`,
`src/vite-plugin.mjs`). Seal bytes with `cloak`, open with `open`,
serve warm files from RAM with `createRest`.

```js
import { cloak, open } from "./src/phi_rest.mjs";

const sealed = cloak(Buffer.from("after fire, rest"));
open(sealed).toString(); // "after fire, rest"
```

Run the suite: `npm test` (`node --test test/`, offline, no network).

## Testing

How to run the suite and what it covers.

## License

Dual-licensed per the repo-root LICENSE pairing; see NOTICE for attribution.
