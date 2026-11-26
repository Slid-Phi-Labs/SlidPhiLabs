#!/usr/bin/env python3
"""TruGame 30-second offline demo.

Spawns falling mesh instances, ticks gravity+ground clamp, renders frames,
optionally encodes MP4 via ffmpeg. Uses license_stub (always alive) — no
Chamber host required.

Run:
  cd trugame-demo-30s
  python demo_30s.py

Deps: matplotlib, numpy. Optional: ffmpeg on PATH.
"""

from __future__ import annotations

import importlib.util
import math
import subprocess
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENGINE = ROOT.parent / "packages" / "trugame-v0.4"
FRAMES = ROOT / "demo_frames"
import os

FPS = 30
SECONDS = int(os.environ.get("TRUGAME_DEMO_SECONDS", "30"))
N_FRAMES = FPS * SECONDS
DT = 1.0 / FPS


def _load_engine():
    """Load trugame-v0.4 modules under a synthetic package name."""
    if not ENGINE.is_dir():
        raise SystemExit(f"engine missing: {ENGINE}")

    # Prefer local license stub over Chamber bridge.
    sys.path.insert(0, str(ROOT))
    import license_stub  # noqa: F401

    pkg_name = "trugame_demo_engine"
    if pkg_name not in sys.modules:
        pkg = types.ModuleType(pkg_name)
        pkg.__path__ = [str(ENGINE)]
        pkg.__package__ = pkg_name
        sys.modules[pkg_name] = pkg

    def load(mod: str):
        full = f"{pkg_name}.{mod}"
        if full in sys.modules:
            return sys.modules[full]
        path = ENGINE / f"{mod}.py"
        spec = importlib.util.spec_from_file_location(full, path)
        m = importlib.util.module_from_spec(spec)
        m.__package__ = pkg_name
        sys.modules[full] = m
        spec.loader.exec_module(m)
        return m

    load("ecs")
    scene = load("scene")
    physics = load("physics")
    return scene, physics, sys.modules[f"{pkg_name}.ecs"]


def main() -> int:
    scene_mod, physics_mod, ecs_mod = _load_engine()
    Scene = scene_mod.Scene
    PhysicsSystem = physics_mod.PhysicsSystem
    Transform = ecs_mod.Transform
    RigidBody = ecs_mod.RigidBody

    world = Scene(name="demo-30s")
    # Seed a few falling "ships" at staggered heights
    seeds = [
        ("models/ship.obj", [0.0, 8.0, 0.0]),
        ("models/crate.obj", [2.0, 12.0, -1.0]),
        ("models/orb.obj", [-2.5, 15.0, 1.5]),
        ("models/panel.obj", [1.2, 20.0, 0.5]),
    ]
    for path, pos in seeds:
        eid = world.add_mesh_instance(path, pos)
        # Attach rigid body for physics (scene helper only adds Transform+Mesh)
        comps = world.ecs.entities[eid]
        comps[RigidBody] = RigidBody()

    # Static ground marker entity (does not fall)
    ground_id = world.ecs.create_entity(
        Transform(pos=[0.0, 0.0, 0.0]),
        RigidBody(is_static=True),
    )

    phys = PhysicsSystem()
    FRAMES.mkdir(parents=True, exist_ok=True)

    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        print("matplotlib/numpy required: pip install matplotlib numpy", file=sys.stderr)
        return 1

    print(f"simulating {N_FRAMES} frames @ {FPS} fps …")
    for i in range(N_FRAMES):
        phys.tick(world.ecs, DT)
        fig, ax = plt.subplots(figsize=(6.4, 3.6), dpi=100)
        ax.set_xlim(-6, 6)
        ax.set_ylim(-0.5, 22)
        ax.set_aspect("equal")
        ax.set_facecolor("#0b1020")
        fig.patch.set_facecolor("#0b1020")
        ax.axhline(0, color="#3d5a80", lw=2)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_title(
            f"TruGame demo  t={i / FPS:05.2f}s  entities={len(world.ecs.entities)}",
            color="#e0e6f0",
            fontsize=10,
        )
        colors = ["#ee6c4d", "#98c1d9", "#e0fbfc", "#f0c808"]
        for n, (eid, comps) in enumerate(
            world.ecs.query(Transform, RigidBody)
        ):
            if eid == ground_id:
                continue
            trans, body = comps
            x, y = trans.pos[0], trans.pos[1]
            r = 0.35 + 0.05 * (n % 3)
            circ = plt.Circle((x, y), r, color=colors[n % len(colors)], ec="#fff", lw=0.5)
            ax.add_patch(circ)
            if not body.is_static:
                ax.arrow(
                    x,
                    y,
                    0,
                    max(-1.5, min(0, body.vel[1] * 0.05)),
                    head_width=0.15,
                    color="#ffffff88",
                    length_includes_head=True,
                )
        # Bitstream delta size as a tiny HUD (engine idea: state compression)
        delta = world.ecs.to_bitstream_delta()
        ax.text(
            0.02,
            0.98,
            f"bitstream_delta={len(delta)} B",
            transform=ax.transAxes,
            va="top",
            color="#98c1d9",
            fontsize=8,
            family="monospace",
        )
        out = FRAMES / f"frame_{i:05d}.png"
        fig.savefig(out, facecolor=fig.get_facecolor())
        plt.close(fig)
        if i % FPS == 0:
            print(f"  {i // FPS:02d}s  wrote {out.name}")

    manifest = world.to_manifest()
    print("manifest entities:", manifest["entities"])

    mp4 = ROOT / "trugame_demo_30s.mp4"
    ffmpeg = _which("ffmpeg")
    if ffmpeg:
        cmd = [
            ffmpeg,
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            str(FRAMES / "frame_%05d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(mp4),
        ]
        print("encoding", mp4.name, "…")
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            print("wrote", mp4)
        else:
            print("ffmpeg failed:", r.stderr[-400:], file=sys.stderr)
    else:
        print("ffmpeg not on PATH — frames only at", FRAMES)

    print("done.")
    return 0


def _which(name: str) -> str | None:
    from shutil import which

    return which(name)


if __name__ == "__main__":
    raise SystemExit(main())
