#!/usr/bin/env python3
"""
repair_wave1_graph.py

Memperbaiki hasil refactor Wave 1 domain graph:

1. Memindahkan file graph ke struktur canonical:
   - components/
   - shared/api/
   - shared/hooks/
   - shared/stores/
   - shared/utils/

2. Memperbarui import relatif dan alias "@/domains/graph/..."
   berdasarkan lokasi file baru.

3. Menghapus HANYA duplikat source yang byte-identical.
   Jika terdapat konflik isi, script berhenti tanpa menimpa source.

4. Mengganti GraphOrchestrator yang memakai API lama dengan compatibility
   bridge agar typecheck kembali bersih sementara GraphLeaf lama tetap menjadi
   implementation aktif.

PENTING:
- Jalankan tanpa --apply terlebih dahulu.
- Script ini membuat snapshot source di .wave1-backup/ sebelum melakukan write.
- Script tidak menghapus file "unreferenced" secara membabi-buta.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ROOT = Path.cwd().resolve()
GRAPH = ROOT / "src" / "domains" / "graph"
BACKUP = ROOT / ".wave1-backup"

SOURCE_SUFFIXES = {".ts", ".tsx"}
IMPORT_RE = re.compile(
    r"""(?P<prefix>\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)
        (?P<quote>["'])
        (?P<spec>[^"']+)
        (?P=quote)""",
    re.VERBOSE,
)


@dataclass(frozen=True)
class Move:
    source: Path
    destination: Path


def die(message: str) -> None:
    print(f"\nERROR: {message}\n", file=sys.stderr)
    raise SystemExit(1)


def relative(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_source(path: Path) -> bool:
    return path.is_file() and path.suffix in SOURCE_SUFFIXES


def add_move(moves: list[Move], source: Path, destination: Path) -> None:
    if source.exists() and source != destination:
        moves.append(Move(source=source, destination=destination))


def prefixed(name: str, prefix: str = "Graph") -> str:
    """BacklinksPanel.tsx -> GraphBacklinksPanel.tsx."""
    return name if name.startswith(prefix) else f"{prefix}{name}"


def build_move_plan() -> list[Move]:
    moves: list[Move] = []

    # ---------------------------------------------------------------------
    # API: services
    # ---------------------------------------------------------------------
    for source in (GRAPH / "services").glob("*"):
        if is_source(source):
            add_move(moves, source, GRAPH / "shared" / "api" / source.name)

    # ---------------------------------------------------------------------
    # Stores: persistent/stateful Zustand or React providers
    # ---------------------------------------------------------------------
    for source in (GRAPH / "stores").glob("*"):
        if is_source(source):
            add_move(moves, source, GRAPH / "shared" / "stores" / source.name)

    for name in ("useGraphInteractionStore.ts", "useLeafGraphConfigStore.ts"):
        source = GRAPH / "model" / name
        if source.exists():
            add_move(moves, source, GRAPH / "shared" / "stores" / name)

    # ---------------------------------------------------------------------
    # Hooks
    # ---------------------------------------------------------------------
    for source in (GRAPH / "hooks").glob("*"):
        if is_source(source):
            add_move(moves, source, GRAPH / "shared" / "hooks" / source.name)

    source = GRAPH / "layout" / "useLayoutEngine.ts"
    if source.exists():
        add_move(moves, source, GRAPH / "shared" / "hooks" / source.name)

    # ---------------------------------------------------------------------
    # Utils: pure functions, rendering helpers, layouts, types/config values
    # ---------------------------------------------------------------------
    for directory in ("render", "layout", "interactions", "model"):
        folder = GRAPH / directory
        if not folder.exists():
            continue

        for source in folder.glob("*"):
            if not is_source(source):
                continue

            # Stateful store/provider files were handled above.
            if source.name in {
                "useGraphInteractionStore.ts",
                "useLeafGraphConfigStore.ts",
                "useLayoutEngine.ts",
                "ContextualToolbar.tsx",
            }:
                continue

            destination_name = (
                "graph.types.ts"
                if source.name == "graphTypes.ts"
                else source.name
            )
            add_move(
                moves,
                source,
                GRAPH / "shared" / "utils" / destination_name,
            )

    # ---------------------------------------------------------------------
    # UI components: one flat directory, all components Graph-prefixed.
    # ---------------------------------------------------------------------
    for source in (GRAPH / "components").glob("*"):
        if not is_source(source):
            continue

        destination = GRAPH / "components" / prefixed(source.name)
        add_move(moves, source, destination)

    source = GRAPH / "interactions" / "ContextualToolbar.tsx"
    if source.exists():
        add_move(
            moves,
            source,
            GRAPH / "components" / "GraphContextualToolbar.tsx",
        )

    for legacy_folder in ("config-panel", "node-panel"):
        folder = GRAPH / legacy_folder
        if not folder.exists():
            continue

        for source in folder.glob("*"):
            if is_source(source):
                add_move(
                    moves,
                    source,
                    GRAPH / "components" / prefixed(source.name),
                )

    controls = GRAPH / "controls"
    if controls.exists():
        for source in controls.glob("*.tsx"):
            if is_source(source):
                add_move(
                    moves,
                    source,
                    GRAPH / "components" / prefixed(source.name),
                )

        panels = controls / "panels"
        if panels.exists():
            for source in panels.glob("*.tsx"):
                if is_source(source):
                    add_move(
                        moves,
                        source,
                        GRAPH / "components" / prefixed(source.name),
                    )

    # Do not move test files. They can remain in __tests__.
    return moves


def validate_plan(moves: Iterable[Move]) -> list[Move]:
    """Detect collisions before changing any file."""
    checked: list[Move] = []
    collisions: list[str] = []

    for item in moves:
        if not item.source.exists():
            continue

        if item.destination.exists() and item.source.resolve() != item.destination.resolve():
            if sha256(item.source) != sha256(item.destination):
                collisions.append(
                    f"- {relative(item.source)}\n"
                    f"  conflicts with {relative(item.destination)}"
                )
                continue

        checked.append(item)

    if collisions:
        die(
            "Ada file tujuan dengan isi BERBEDA. Script dihentikan agar tidak "
            "menghapus perubahan Anda.\n\n"
            + "\n".join(collisions)
            + "\n\nSelesaikan setiap pasangan di atas secara manual: pilih "
              "versi canonical, lalu jalankan script kembali."
        )

    return checked


def backup_sources(paths: Iterable[Path]) -> None:
    for source in paths:
        if not source.exists() or not source.is_file():
            continue

        target = BACKUP / source.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def module_from_path(path: Path) -> str:
    """
    Menghasilkan path import TypeScript tanpa ekstensi:
    foo.ts -> foo
    index.ts -> folder
    """
    value = path.with_suffix("")
    if value.name == "index":
        value = value.parent
    return str(value).replace("\\", "/")


def resolve_specifier(base_file: Path, specifier: str) -> Path | None:
    """
    Resolve local / alias module specifier to a physical source file when ada.
    Tidak menyentuh package import seperti react, zustand, lucide-react.
    """
    if specifier.startswith("@/"):
        candidate = ROOT / "src" / specifier[2:]
    elif specifier.startswith("."):
        candidate = (base_file.parent / specifier).resolve()
    else:
        return None

    candidates = [
        candidate,
        candidate.with_suffix(".ts"),
        candidate.with_suffix(".tsx"),
        candidate / "index.ts",
        candidate / "index.tsx",
    ]

    for item in candidates:
        if item.exists():
            return item.resolve()

    return None


def build_rewrite_map(moves: Iterable[Move]) -> dict[Path, Path]:
    return {
        item.source.resolve(): item.destination.resolve()
        for item in moves
        if item.source.exists()
    }


def import_specifier_for(source_file: Path, target_file: Path) -> str:
    """
    Semua graph-internal import distandarkan menjadi alias absolute supaya
    perpindahan folder berikutnya tidak mematahkan relative import lagi.
    """
    src_root = ROOT / "src"
    target_no_ext = Path(module_from_path(target_file))

    try:
        return "@/" + str(target_no_ext.relative_to(src_root)).replace("\\", "/")
    except ValueError:
        relative_path = Path(
            __import__("os").path.relpath(target_no_ext, source_file.parent)
        )
        text = str(relative_path).replace("\\", "/")
        return text if text.startswith(".") else f"./{text}"


def rewrite_imports(
    source_file: Path,
    original_file: Path,
    rewrite_map: dict[Path, Path],
) -> bool:
    """
    `original_file` dipakai untuk membaca import relatif lama sebelum file
    dipindahkan. Target import kemudian ditulis dalam alias canonical.
    """
    if not is_source(source_file):
        return False

    content = source_file.read_text(encoding="utf-8")
    changed = False

    def replace(match: re.Match[str]) -> str:
        nonlocal changed

        specifier = match.group("spec")
        resolved = resolve_specifier(original_file, specifier)

        if resolved is None:
            return match.group(0)

        destination = rewrite_map.get(resolved, resolved)

        # Rewrite hanya dependency yang berada di domain graph.
        try:
            destination.relative_to(GRAPH)
        except ValueError:
            return match.group(0)

        new_specifier = import_specifier_for(source_file, destination)
        if new_specifier == specifier:
            return match.group(0)

        changed = True
        return f'{match.group("prefix")}{match.group("quote")}{new_specifier}{match.group("quote")}'

    next_content = IMPORT_RE.sub(replace, content)

    if changed:
        source_file.write_text(next_content, encoding="utf-8")

    return changed


def write_orchestrator_bridge(apply: bool) -> None:
    """
    Menghilangkan GraphOrchestrator versi salah yang memakai API stale:
    selectedNodeId, hoverNodeId, zoomIn, zoomOut, fitView, resetZoom, dsb.

    Bridge ini menjaga build tetap bersih SELAMA GraphLeaf lama masih menjadi
    host aktif. Setelah Phase 2 extraction, body GraphLeaf dipindahkan ke sini
    dan bridge ini dapat diganti dengan orchestrator sebenarnya.
    """
    path = GRAPH / "GraphOrchestrator.tsx"
    content = """\
/**
 * GraphOrchestrator
 *
 * Transitional compatibility boundary for Wave 1.
 * The current, tested graph host remains GraphLeaf. This prevents a second
 * graph lifecycle while imports are being migrated to the flat domain shape.
 *
 * Phase 2 moves GraphLeafBody here and makes GraphLeaf a one-line adapter.
 */

import type { LeafViewProps } from "@/domains/workspace/registry/ViewRegistry";
import GraphLeaf from "@/domains/workspace/views/GraphLeaf";

export function GraphOrchestrator(props: LeafViewProps) {
  return <GraphLeaf {...props} />;
}

export default GraphOrchestrator;
"""
    if not apply:
        print(f"  WRITE  {relative(path)} (replace stale API implementation)")
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def remove_empty_legacy_directories(apply: bool) -> None:
    legacy = [
        GRAPH / "config-panel",
        GRAPH / "controls" / "panels",
        GRAPH / "controls",
        GRAPH / "hooks",
        GRAPH / "interactions",
        GRAPH / "layout",
        GRAPH / "model",
        GRAPH / "node-panel",
        GRAPH / "render",
        GRAPH / "services",
        GRAPH / "stores",
    ]

    for folder in legacy:
        if folder.exists() and folder.is_dir() and not any(folder.iterdir()):
            print(f"  RMDIR  {relative(folder)}")
            if apply:
                folder.rmdir()


def report_unreferenced_candidates() -> None:
    """
    Hanya melaporkan kandidat; tidak menghapusnya.
    Dynamic import dan exports dapat membuat analisis regex tidak cukup aman
    untuk destructive delete.
    """
    all_sources = [
        path
        for path in (ROOT / "src").rglob("*")
        if is_source(path) and "node_modules" not in path.parts
    ]
    corpus = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in all_sources
    )

    candidates: list[Path] = []
    for path in (GRAPH / "components").glob("*"):
        if not is_source(path):
            continue
        stem = path.stem
        if corpus.count(stem) <= 1:
            candidates.append(path)

    if candidates:
        print("\nKandidat komponen tanpa referensi tekstual (TIDAK dihapus):")
        for item in candidates:
            print(f"  ? {relative(item)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Menerapkan pemindahan, rewrite import, dan cleanup duplikat identik.",
    )
    args = parser.parse_args()

    if not GRAPH.exists():
        die(f"Folder graph tidak ditemukan: {relative(GRAPH)}")

    moves = validate_plan(build_move_plan())
    rewrite_map = build_rewrite_map(moves)

    print("\nWave 1 graph repair")
    print("=" * 72)
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")
    print(f"Planned canonical moves: {len(moves)}\n")

    if args.apply:
        backup_sources(
            [item.source for item in moves]
            + [GRAPH / "GraphOrchestrator.tsx"]
        )
        print(f"Snapshot source: {relative(BACKUP)}\n")

    original_locations: dict[Path, Path] = {}

    for item in moves:
        source = item.source
        destination = item.destination
        destination.parent.mkdir(parents=True, exist_ok=True)

        if destination.exists():
            # validate_plan already proved both contents are identical.
            print(f"  REMOVE DUPLICATE  {relative(source)}")
            if args.apply:
                source.unlink()
            original_locations[destination.resolve()] = source.resolve()
            continue

        print(f"  MOVE  {relative(source)}")
        print(f"     -> {relative(destination)}")

        if args.apply:
            shutil.move(str(source), str(destination))

        original_locations[destination.resolve()] = source.resolve()

    if args.apply:
        print("\nRewriting graph imports...")
        rewrites = 0

        # Include every TS/TSX file, so external consumers of graph are updated.
        for file in (ROOT / "src").rglob("*"):
            if not is_source(file):
                continue

            # A moved graph file must resolve old relative imports from
            # its source directory; unchanged files resolve from their own.
            original = original_locations.get(file.resolve(), file.resolve())
            if rewrite_imports(file, original, rewrite_map):
                rewrites += 1

        print(f"  Updated imports in {rewrites} file(s).")
    else:
        print("\n  DRY RUN: import rewrites are not written.")

    print("\nGraphOrchestrator repair:")
    write_orchestrator_bridge(args.apply)

    print("\nLegacy directory cleanup:")
    remove_empty_legacy_directories(args.apply)

    report_unreferenced_candidates()

    print("\nNext commands:")
    print("  bun test src/domains/graph/")
    print("  bunx tsgo --noEmit -p tsconfig.app.json")
    print("  bun run build:dev")


if __name__ == "__main__":
    main()