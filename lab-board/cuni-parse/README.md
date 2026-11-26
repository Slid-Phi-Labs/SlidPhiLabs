# cuni-parse

> GID starter README (0.1.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What cuni-parse does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Library crate, entry point `src/lib.rs`: `parse_decl(language, source)`
finds the top-level declaration for `python` / `typescript` / `solidity`
/ `go`, returning `None` for anything else. Cases below are pinned by
the in-crate `#[test] four_languages`.

```rust
use cuni_parse::parse_decl;

let d = parse_decl("python", "def spend():\n  pass").unwrap();
assert_eq!(d.name, "spend");
assert_eq!(d.kind, "function");

assert!(parse_decl("rust", "fn spend() {}").is_none());
```

Run the suite: `cargo test` (needs the Rust toolchain in
`rust-toolchain.toml`; native builds are blocked on boxes without a
linker, including this one).

## Testing

How to run the suite and what it covers.

## License

Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc Commercial License. See the LICENSE files at the owning project root.
