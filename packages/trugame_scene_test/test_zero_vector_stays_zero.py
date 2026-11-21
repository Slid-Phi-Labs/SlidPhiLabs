"""Zero velocity under zero gravity stays at the origin.

The engine folder is named trugame-v0.4, so pytest cannot import it as a
package. This file lives beside that folder and loads physics.py directly.
"""
import importlib.util
import sys
import types
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent / "trugame-v0.4"
_PKG = "trugame_v04_under_test"
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


ecs = _load("ecs")
physics = _load("physics")


def test_zero_vector_stays_zero():
    world = ecs.WorldECS()
    world.create_entity(ecs.Transform(), ecs.RigidBody())
    physics.PhysicsSystem(gravity=[0.0, 0.0, 0.0]).tick(world, dt=1.0)
    _, (trans, body) = next(world.query(ecs.Transform, ecs.RigidBody))
    assert trans.pos == [0.0, 0.0, 0.0]
    assert body.vel == [0.0, 0.0, 0.0]
