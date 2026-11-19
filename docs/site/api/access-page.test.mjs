import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Buyers land on /access (served from access/index.html), so both copies of the
// access page need the subscription controls.
for (const f of ["../access/index.html", "../access.html"]) {
  test(`${f} shows Manage or cancel and handles a cancelled plan`, () => {
    const html = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.match(html, /j\.subscription\.manage/);
    assert.match(html, />Manage or cancel</);
    assert.match(html, /Plan cancelled/);
    assert.match(html, /params\.get\('session_id'\)/);
  });
}
