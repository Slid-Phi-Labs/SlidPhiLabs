# @slidphi/db

> GID starter README (0.1.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What @slidphi/db does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Schema entry: `ledger.sql` (points at `lab-board/identity/ledger.sql`,
the Postgres ledger for Ed25519 identities — not applied to a server).

```sql
-- agent identities, one row per agent
create table if not exists agent_identity (
  agent_id text primary key,
  ...
);
-- filed identity receipts, referencing the agent
create table if not exists identity_receipt (
  ...
  agent_id text not null references agent_identity(agent_id),
  ...
);
```

Run the suite: `npm test` (`node --test db.test.mjs`, 3 pass —
pointer, tables/keys, and tamper-flagging).

## Testing

How to run the suite and what it covers.

## License

Dual-licensed AGPL-3.0-or-later OR the Slid Phi Labs, Inc Commercial License. See the LICENSE files at the owning project root.
