"""In-package smoke test: scene manifest and a physics tick.

Lives in test/ (no __init__.py) because the folder name (trugame-v0.4) is
not an importable package name — pytest must not treat the parent dir as
a package. Modules load directly under a synthetic package name, the same
trick as the sibling trugame_scene_test suite. No live hosts needed.

Engine behavior pinned here: gravity pulls free bodies down and the ground
plane clamps them at y=0 (pos and velocity both zeroed on contact).
"""

import importlib.util
import sys
import types
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_PKG = "trugame_v04_in_package"
if _PKG not in sys.modules:
    pkg = types.ModuleType(_PKG)
    pkg.__path__ = [str(_ROOT)]
    pkg.__package__ = _PKG
    sys.modules[_PKG] = pkg


def _load(name: str):
    full = f"{_PKG}.{name}"
    if full in sys.modules:
        return sys.modules[full]
    spec = importlib.util.spec_from_file_location(full, _ROOT / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    mod.__package__ = _PKG
    sys.modules[full] = mod
    spec.loader.exec_module(mod)
    return mod


_load("ecs")
scene_mod = _load("scene")
ecs_mod = _load("ecs")
physics_mod = _load("physics")


def test_scene_empty_manifest():
    created = scene_mod.Scene(name="smoke-empty")
    manifest = created.to_manifest()
    assert manifest["scene"] == "smoke-empty"
    assert manifest["entities"] == 0
    assert manifest["instances"] == []


def test_add_mesh_instance_registers():
    created = scene_mod.Scene(name="smoke-mesh")
    eid = created.add_mesh_instance("models/ship.obj", [1.0, 2.0, 3.0])
    manifest = created.to_manifest()
    assert manifest["entities"] == 1
    assert manifest["instances"][0]["id"] == eid
    assert manifest["instances"][0]["pos"] == [1.0, 2.0, 3.0]
    assert manifest["instances"][0]["original"] == "models/ship.obj"


def test_physics_tick_falls_short_of_ground():
    ecs = ecs_mod.WorldECS()
    ecs.create_entity(
        ecs_mod.Transform(pos=[0.0, 5.0, 0.0]),
        ecs_mod.RigidBody(),
    )
    physics_mod.PhysicsSystem().tick(ecs, 0.1)
    (trans, _), = [comps for _, comps in ecs.query(
        ecs_mod.Transform, ecs_mod.RigidBody)]
    assert trans.pos[1] < 5.0
    assert trans.pos[1] > 0.0


def test_physics_tick_clamps_at_ground():
    ecs = ecs_mod.WorldECS()
    ecs.create_entity(
        ecs_mod.Transform(pos=[0.0, 0.0, 0.0]),
        ecs_mod.RigidBody(),
    )
    physics_mod.PhysicsSystem().tick(ecs, 1.0)
    (trans, body), = [comps for _, comps in ecs.query(
        ecs_mod.Transform, ecs_mod.RigidBody)]
    assert trans.pos[1] == 0.0
    assert body.vel[1] == 0


def test_physics_tick_skips_static_body():
    ecs = ecs_mod.WorldECS()
    ecs.create_entity(
        ecs_mod.Transform(pos=[5.0, 5.0, 5.0]),
        ecs_mod.RigidBody(is_static=True),
    )
    physics_mod.PhysicsSystem().tick(ecs, 1.0)
    (trans, _), = [comps for _, comps in ecs.query(
        ecs_mod.Transform, ecs_mod.RigidBody)]
    assert trans.pos == [5.0, 5.0, 5.0]
