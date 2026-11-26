# trugame-v0.4

> GID starter README (0.1.0). Flesh out each section below with the product's real behavior before calling this doc done.

## What trugame-v0.4 does

Short paragraph: who it serves, what it computes or serves, and where it sits in the lab stack.

## Install

Commands to install, required runtimes, and environment variables. Keep secrets in the vault, never here.

## Usage

Modules load directly (the folder name is not an importable package);
see `test/test_trugame_smoke.py` for the loader pattern. Engine entry
points are license-gated (`license_bridge.gate`); the ECS/scene/physics
layers run without a license.

```powershell
cd packages/trugame-v0.4
python -m pytest test/ -q
# 6 passed
```

Spawn a mesh and tick it — modules load via `importlib` by path
(full pattern in `test/test_trugame_smoke.py`):

```python
scene = scene_mod.Scene(name="demo")
scene.add_mesh_instance("models/ship.obj", [1.0, 2.0, 3.0])
physics_mod.PhysicsSystem().tick(scene.ecs, 1 / 60)
scene.to_manifest()["entities"]  # 1
```

## Testing

How to run the suite and what it covers.

## License

Dual-licensed per the repo-root LICENSE pairing; see NOTICE for attribution.
