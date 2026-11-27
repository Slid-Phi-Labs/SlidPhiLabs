# @slidphi/lab-dashboard

> GID starter README (0.1.0). Lab warrants + spend page. Lab mode without Clerk.

## Usage

Entry point: `server.mjs`. Reads `data/warrant/{warrants,receipts}.json`
under the given dir (default `./data/warrant`) and renders the Agents
and spend page. Serves `http://127.0.0.1:4317` (`node server.mjs`).
Co-op board at `/lanes` (L / OPEN / R columns backed by
`data/lanes.json`); claim, release, and done via
`POST /lanes/claim|release|done` (JSON or form posts, crew names only:
muse, tandem, grok).

```js
import { page } from "./server.mjs";

page(); // HTML with "Agents and spend", "0 warrants, 0 receipts ..."
// with an empty warrant dir: "No warrants on disk." + Download receipts link
```

Run the suite: `npm test` (`node --test server.test.mjs lanes.test.mjs`, 8 pass).

## License

Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc Commercial License. See the LICENSE files at the owning project root.
