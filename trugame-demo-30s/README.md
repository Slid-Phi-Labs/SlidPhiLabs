# TruGame 30-second demo (standalone)

Offline ECS + gravity demo for `packages/trugame-v0.4`. Uses `license_stub.py`
(always alive) — no Chamber host.

## Requirements
```bash
pip install matplotlib numpy
# ffmpeg on PATH for mp4 encode (optional — frames still render without it)
```

## Run
```bash
cd trugame-demo-30s
python demo_30s.py
# quick smoke:
# set TRUGAME_DEMO_SECONDS=3 && python demo_30s.py
```

Outputs:
- `demo_frames/frame_XXXXX.png` — rendered frames
- `trugame_demo_30s.mp4` — 30s video (if ffmpeg available)

## What it shows
Falling mesh instances, ground clamp, bitstream-delta HUD — the engine-seat
idea in a short loop. **No SKU / no price** until Corey decides product-or-archive.
