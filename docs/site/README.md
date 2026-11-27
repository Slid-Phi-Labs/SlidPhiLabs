# slidphilabs-site

> GID starter README (1.0.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What slidphilabs-site does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Entry point: `server.mjs` (Fly.io host: static files + `/api/*.js`
handlers). Route table lives in `api/lib/call-doors.mjs`.

```js
import { siteRewrite, aliasTool } from "./api/lib/call-doors.mjs";

siteRewrite("/v1/warrant/revoke"); // "/api/warrant/revoke"
siteRewrite("/nope-xyz");          // null — no rewrite, falls to static
aliasTool("compress");             // "spl_compress"
aliasTool("bogus-tool");          // null — refused without any network
```

Run it: `npm start` (serves `PORT`, default 8080). Run the gate:
`npm test` (site suites + `test/site-smoke.test.mjs`).

## Testing

How to run the suite and what it covers.

## License

Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc Commercial License. See the LICENSE files at the owning project root.
