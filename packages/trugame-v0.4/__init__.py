"""TruGame v0.4 — engine folder.

Deliberately import-free: the folder name (trugame-v0.4) is not an
importable package name, so relative re-exports can never execute —
previous revisions imported streamer/renderer/netcode/assets/compression/
loader (none of which ship here) plus a license chain needing the external
json-chamber SDK, which made the whole folder uncollectible by pytest.
Import the modules you need directly (core, ecs, physics, scene,
license_bridge); see test/ for the loader pattern.
"""

__version__ = "0.4.1"
