import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { page } from "./server.mjs";

test("the dashboard page names agents and spend", () => {
  const html = page();
  assert.match(html, /Agents and spend/);
  assert.match(html, /receipts\.json/);
  assert.match(html, /Spend/);
});

test("a corrupt warrant file is refused without breaking the page", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lab-warrants-"));
  try {
    fs.mkdirSync(path.join(dir, "warrants"));
    fs.writeFileSync(path.join(dir, "warrants", "broken.json"), "{not json");
    const html = page(dir);
    assert.match(html, /0 warrants/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an empty warrant directory still returns the empty sentence and receipts link", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lab-warrants-"));
  try {
    fs.mkdirSync(path.join(dir, "warrants"));
    const html = page(dir);
    assert.match(html, /No warrants/);
    assert.match(html, /receipts\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
