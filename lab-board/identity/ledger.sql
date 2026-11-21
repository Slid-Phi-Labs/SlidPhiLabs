-- Postgres ledger for Ed25519 agent identities. Not applied to a server.
create table if not exists agent_identity (
  agent_id text primary key,
  public_key text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists identity_receipt (
  id bigserial primary key,
  agent_id text not null references agent_identity(agent_id),
  body text not null,
  signature text not null,
  filed_at timestamptz not null default now()
);
