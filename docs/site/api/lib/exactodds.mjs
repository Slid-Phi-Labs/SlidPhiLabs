/** Deterministic draw. The same seed and the same list always pick the same outcome. */
export function draw(seed, outcomes) {
  const list = Array.isArray(outcomes) ? outcomes.filter((item) => item != null && item !== "") : [];
  if (!list.length) return { ok: false, reason: "no_outcomes" };
  const text = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (Math.imul(hash, 33) + text.charCodeAt(i)) >>> 0;
  return { ok: true, seed: text, pick: list[hash % list.length] };
}

/** A resolution matches only the pick from that draw. */
export function resolve(drawn, outcome) {
  if (!drawn || drawn.ok !== true) return { ok: false, reason: "no_draw" };
  const match = drawn.pick === outcome;
  return { ok: match, reason: match ? "match" : "mismatch", pick: drawn.pick };
}
