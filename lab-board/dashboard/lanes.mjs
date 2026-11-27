import fs from "node:fs";
import path from "node:path";

export const LANES = ["L", "R"];
export const CREW = ["muse", "tandem", "grok"];

const laneFile = (dir) => path.join(dir, "lanes.json");

export function blankLanes() {
  return {
    L: { holder: null, items: [] },
    R: { holder: null, items: [] },
    open: [],
  };
}

export function loadLanes(dir) {
  const file = laneFile(dir);
  if (!fs.existsSync(file)) return blankLanes();
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Atomic write: tmp file + rename, never a half-written board. */
export function saveLanes(dir, board) {
  const file = laneFile(dir);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(board, null, 2));
  fs.renameSync(tmp, file);
  return board;
}

function findOpen(board, id) {
  return board.open.findIndex((row) => row.id === id);
}

function findHeld(board, id) {
  for (const lane of LANES) {
    const i = board[lane].items.findIndex((row) => row.id === id);
    if (i >= 0) return { lane, i };
  }
  return null;
}

/**
 * Claim an open item into a lane. First claim on an empty lane also
 * seats that lane's holder. Fails closed on unknown id, bad lane,
 * unknown crew name, or an item already held.
 */
export function claim(dir, id, lane, by) {
  if (!LANES.includes(lane)) return { ok: false, reason: "bad_lane" };
  if (!CREW.includes(by)) return { ok: false, reason: "bad_crew" };
  const board = loadLanes(dir);
  if (findHeld(board, id)) return { ok: false, reason: "already_held" };
  const i = findOpen(board, id);
  if (i < 0) return { ok: false, reason: "unknown_id" };
  const [row] = board.open.splice(i, 1);
  if (!board[lane].holder) board[lane].holder = by;
  board[lane].items.push({ ...row, holder: by });
  saveLanes(dir, board);
  return { ok: true, lane, holder: board[lane].holder, id };
}

export function release(dir, id) {
  const board = loadLanes(dir);
  const held = findHeld(board, id);
  if (!held) return { ok: false, reason: "not_held" };
  const [row] = board[held.lane].items.splice(held.i, 1);
  delete row.holder;
  board.open.push(row);
  if (board[held.lane].items.length === 0) board[held.lane].holder = null;
  saveLanes(dir, board);
  return { ok: true, lane: held.lane, id };
}

export function done(dir, id, by) {
  const board = loadLanes(dir);
  const held = findHeld(board, id);
  if (!held) return { ok: false, reason: "not_held" };
  const [row] = board[held.lane].items.splice(held.i, 1);
  if (board[held.lane].items.length === 0) board[held.lane].holder = null;
  saveLanes(dir, board);
  return { ok: true, lane: held.lane, id, by: by || null };
}
