# api/lib — audited module notes

Four single-module products live here as focus entries. Each snippet
below was executed against the module; expected outputs are verbatim.

## Usage

### exactodds — deterministic draw

```js
import { draw, resolve } from "./exactodds.mjs";

draw("lab-seed", ["home", "away", "draw"]);
// { ok: true, seed: "lab-seed", pick: "away" }

resolve(draw("lab-seed", ["home", "away", "draw"]), "away");
// { ok: true, reason: "match", pick: "away" }
```

Empty lists are refused (`no_outcomes`); resolving a non-draw is
refused (`no_draw`). Suite: `node --test exactodds.test.mjs` (3 pass).

### persisted-registry — file-backed tool registry

```js
import { createPersistedRegistry } from "./persisted-registry.mjs";

// In-memory fs adapter (default adapter uses node:fs, no network).
const files = new Map();
const fs = {
  readFile: (p) => {
    if (!files.has(p)) { const e = new Error("x"); e.code = "ENOENT"; throw e; }
    return files.get(p);
  },
  appendFile: (p, s) => files.set(p, (files.get(p) ?? "") + String(s)),
  writeFile: (p, s) => files.set(p, String(s)),
  rename: (a, b) => { files.set(b, files.get(a)); files.delete(a); },
};

const r = createPersistedRegistry({ path: "reg.jsonl", fs });
r.register({ id: "spl_compress", version: "1.0.0", price_cents: 100,
  endpoint: "https://api.example.com/compress", schema: null });
r.get("spl_compress").tool.price_cents; // 100 (unpinned get: top semver)
r.get("nope").reason; // "unknown_tool"
```

Writes are atomic (tmp + rename) behind a lockfile; a held lock fails
closed with `lock_busy`. Suite: part of the site `npm test` gate.

### cuni-calls — nine CuNi verbs, offline-safe surface

```js
import { cuniVerb, dispatchCuni } from "./cuni-calls.mjs";

cuniVerb("check");     // "check"
cuniVerb("cuni_bank"); // "translate" (alias)
cuniVerb("bogus");     // null — unknown verbs resolve to nothing
await dispatchCuni("bogus", {}); // null — refused without any network
```

Live dispatch POSTs to `LAB_CALLS_URL` (or the lab default) and needs
payment; unknown verbs never touch the network. Suite: `cuni-calls.test.mjs`.

### usage-meter — quota keys and counters

```js
import { identityDay, monthKey, ANON_INCLUDED_BYTES } from "./usage-meter.mjs";

identityDay(new Date("2026-01-15T12:00:00Z")); // "2026-01-15" (UTC slice)
monthKey(new Date("2026-03-04T00:00:00Z"));    // "2026-03"
ANON_INCLUDED_BYTES; // 10485760 (10 MiB anonymous allowance)
```

Day/month keys are pure UTC calendar slices; quotas fail closed.
Suite: `usage-meter.test.mjs`.

## Testing

All four module suites run in the site gate (`npm test` in `docs/site`):
`usage-meter.test.mjs`, `exactodds.test.mjs`,
`persisted-registry.test.mjs`, `cuni-calls.test.mjs`.
