"""A new Scene has no entities and an empty manifest.

The engine folder is named trugame-v0.4, so pytest cannot import it as a
package. This file lives beside that folder and loads scene.py directly.
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


_load("ecs")
scene = _load("scene")


def test_scene_starts_empty():
    created = scene.Scene(name="empty")
    assert created.ecs.entities == {}
    assert created.original_assets == {}
    manifest = created.to_manifest()
    assert manifest["scene"] == "empty"
    assert manifest["entities"] == 0
    assert manifest["instances"] == []
