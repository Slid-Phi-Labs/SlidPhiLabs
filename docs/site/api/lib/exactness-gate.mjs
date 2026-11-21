/**
 * The CuNi gate rule, without running the compiler.
 * A seat is kept only when every stdout is the same string.
 * One different stdout refuses the whole set.
 */
export function exactnessGate(seats) {
  const rows = Array.isArray(seats) ? seats : [];
  if (!rows.length) return { ok: false, reason: "no_seats" };
  const first = String(rows[0].stdout ?? "");
  const mismatched = rows.filter((row) => String(row.stdout ?? "") !== first).map((row) => row.name);
  if (mismatched.length) return { ok: false, reason: "mismatch", seats: mismatched };
  return { ok: true, stdout: first, seats: rows.map((row) => row.name) };
}
