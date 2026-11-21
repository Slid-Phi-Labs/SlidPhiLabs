"""core._undress unpacks bytes to bits. physics.py has no pure function.

The engine folder is named trugame-v0.4, so pytest cannot import it as a
package. This file lives beside that folder and loads core.py directly.
core imports the license bridge at import time; that bridge needs
json_chamber, which this test does not call.
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


def _allow_core_import():
    if "json_chamber" in sys.modules:
        return False
    try:
        importlib.import_module("json_chamber")
        return False
    except ImportError:
        pass
    stub = types.ModuleType("json_chamber")

    class LicenseError(Exception):
        pass

    stub.LicenseError = LicenseError
    stub.require_alive = lambda product="trugame": {"status": "alive", "product": product}
    stub.license_status = lambda product="trugame": {"status": "alive", "product": product}
    stub.apply_entitlement = lambda token: {"status": "alive"}
    sys.modules["json_chamber"] = stub
    return True


_stubbed_chamber = _allow_core_import()
core = _load("core")
if _stubbed_chamber:
    sys.modules.pop("json_chamber", None)


def test_undress_zero_byte_is_eight_zero_bits():
    assert core._undress(b"\x00") == [0, 0, 0, 0, 0, 0, 0, 0]
