# Changelog — cuni

## 2026-11-26 — GID deep-rubric pass

- Declared the package surface in `package.json` (`main: ./index.mjs`,
  `exports: {".": ./index.mjs}`) so the entry is importable (G-SURF-01).
- Documented real `Usage` in `README.md` with verified example output.
- Suite green: `npm test` runs `node --test silent-rules.test.mjs`,
  2 pass / 0 fail / 0 skipped.

## 0.1.0 — GID baseline

- Initial standing-record entry.
