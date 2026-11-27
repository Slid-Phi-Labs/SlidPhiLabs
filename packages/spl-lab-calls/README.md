# spl-lab-calls

> GID starter README (0.1.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What spl-lab-calls does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Entry point: `spl_lab_calls.py`. One Python client for lab calls that
already have an engine. Each function POSTs to the site origin; HTTP 402
raises `PaymentRequired` with the door's own body. Override the host with
`LAB_CALLS_URL`. Local binaries stay unmetered.

```python
import spl_lab_calls as lab

lab.endpoint("compress")  # "https://www.slidphilabs.com/v1/compress"
lab.PRICES_USD["check"]   # "0.05" (flat per-call fees only)
lab.base_url()            # "https://www.slidphilabs.com"
```

Run the suite: `python -m pytest . -q` (offline; 402s served by a
local stub server in the test).

## Testing

How to run the suite and what it covers.

## License

Dual-licensed per the repo-root LICENSE pairing; see NOTICE for attribution.
