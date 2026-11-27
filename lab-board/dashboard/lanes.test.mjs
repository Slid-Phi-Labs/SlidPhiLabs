import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  blankLanes,
  loadLanes,
  saveLanes,
  claim,
  release,
  done,
} from "./lanes.mjs";

function tmpBoard() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lab-lanes-"));
  const board = blankLanes();
  board.open.push({ id: "issue-1", title: "First open item", source: "issue" });
  board.open.push({ id: "lab-x", title: "Second open item", source: "lab-task" });
  saveLanes(dir, board);
  return dir;
}

test("missing board file loads blank lanes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lab-lanes-"));
  const board = loadLanes(path.join(dir, "nowhere"));
  assert.deepEqual(board, blankLanes());
});

test("claim moves open to lane and seats the holder", () => {
  const dir = tmpBoard();
  const r = claim(dir, "issue-1", "L", "muse");
  assert.equal(r.ok, true);
  assert.equal(r.holder, "muse");
  const board = loadLanes(dir);
  assert.equal(board.open.length, 1);
  assert.equal(board.L.holder, "muse");
  assert.equal(board.L.items[0].holder, "muse");
});

test("claim rejects bad lane, bad crew, unknown id, double claim", () => {
  const dir = tmpBoard();
  assert.equal(claim(dir, "issue-1", "C", "muse").reason, "bad_lane");
  assert.equal(claim(dir, "issue-1", "L", "mallory").reason, "bad_crew");
  assert.equal(claim(dir, "nope", "L", "muse").reason, "unknown_id");
  assert.equal(claim(dir, "issue-1", "L", "muse").ok, true);
  assert.equal(claim(dir, "issue-1", "R", "grok").reason, "already_held");
});

test("release returns the item to open and frees an empty seat", () => {
  const dir = tmpBoard();
  claim(dir, "issue-1", "R", "tandem");
  const r = release(dir, "issue-1");
  assert.equal(r.ok, true);
  const board = loadLanes(dir);
  assert.equal(board.R.holder, null);
  assert.ok(board.open.some((row) => row.id === "issue-1"));
  assert.equal(release(dir, "issue-1").reason, "not_held");
});

test("done removes the item without returning it", () => {
  const dir = tmpBoard();
  claim(dir, "lab-x", "L", "grok");
  const r = done(dir, "lab-x", "grok");
  assert.equal(r.ok, true);
  const board = loadLanes(dir);
  assert.equal(board.L.items.length, 0);
  assert.equal(board.open.some((row) => row.id === "lab-x"), false);
  assert.equal(done(dir, "lab-x").reason, "not_held");
});
