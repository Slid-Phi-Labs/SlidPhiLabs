# @slidphi/phi-rest

**Toy / pattern library — not a priced product.** No SKU, no meter, no
checkout. “After fire, rest”: open once, serve from RAM.

## What it does

Small offline helpers: seal bytes with `cloak`, open with `open`, and
serve a warm file tree from RAM via `createRest` / the Vite plugin.
Useful as a lab pattern; do not sell or quote as a commercial surface.

## Install

Private package in this monorepo (`packages/phi-rest`). Node 18+. No
env secrets required for the unit suite.

## Usage

Entry point: `src/phi_rest.mjs` (also `src/phi_rest.cjs`,
`src/vite-plugin.mjs`).

```js
import { cloak, open } from "./src/phi_rest.mjs";

const sealed = cloak(Buffer.from("after fire, rest"));
open(sealed).toString(); // "after fire, rest"
```

Run the suite: `npm test` (`node --test test/`, offline, no network).

## Testing

`npm test` covers cloak/open round-trip and RAM serve paths without
network.

## License

Dual-licensed per the repo-root LICENSE pairing; see NOTICE for attribution.
