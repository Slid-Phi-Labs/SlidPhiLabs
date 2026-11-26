# psi-interlink doctor — Windows path reliability (TOP100 #16)

Dated: 2026-11-26. Host: Corey Win box (`C:\Users\ptasz`). Peer: `muse`.

## Command

```powershell
cd C:\Users\ptasz\psi
$env:PYTHONPATH='C:\Users\ptasz\psi'
python -m interlink doctor --peer muse
```

## Transcript

```
doctor OK home=C:\Users\ptasz\.psi\a2a
  [PASS] ring.key: present 32 bytes
  [PASS] ring_id: f78f1be441b6d56ea8131e8faa17a0e1
  [PASS] local_peers: local=['grok', 'muse']
  [PASS] self_pk_published: pk on peer card
  [PASS] membership: admitted
  [PASS] charter: active:cb23ee79
  [PASS] pending_backlog: inbox_bytes=0 broadcast_bytes=0
  [PASS] peer_sk_present: sk file exists (not shown)
  [PASS] no_secrets_in_repo_package: leaked=none
  admitted: grok, muse
```

## Path notes

- Runtime home resolves via `Path.home() / ".psi" / "a2a"` → `C:\Users\ptasz\.psi\a2a` (no POSIX-only joins).
- `PYTHONPATH=C:\Users\ptasz\psi` works under PowerShell; package import `interlink` loads.
- Result: **9/9 PASS**. No Windows path failure observed; no psi code change required this pass.
- psi push remains blocked without Corey go; this ledger transcript is the SlidPhiLabs proof surface.
