#!/usr/bin/env python3
"""
convert_and_repair_wave1.py

1. Mengonversi SEMUA import relatif (../../, ../, ./) di seluruh src/**/*.{ts,tsx}
   menjadi alias dynamic path '@/...'.
2. Memetakan import lama domain graph ke canonical Wave 1:
   - @/domains/graph/services/*           -> @/domains/graph/shared/api/*
   - @/domains/graph/stores/*             -> @/domains/graph/shared/stores/*
   - @/domains/graph/model/use*Store*     -> @/domains/graph/shared/stores/*
   - @/domains/graph/model/graphTypes*    -> @/domains/graph/shared/utils/graph.types*
   - @/domains/graph/model/*              -> @/domains/graph/shared/utils/*
   - @/domains/graph/hooks/*              -> @/domains/graph/shared/hooks/*
   - @/domains/graph/layout/useLayoutEngine* -> @/domains/graph/shared/hooks/useLayoutEngine*
   - @/domains/graph/layout/*             -> @/domains/graph/shared/utils/*
   - @/domains/graph/render/*             -> @/domains/graph/shared/utils/*
   - @/domains/graph/interactions/ContextualToolbar* -> @/domains/graph/components/GraphContextualToolbar*
   - @/domains/graph/interactions/*       -> @/domains/graph/shared/utils/*
   - @/domains/graph/controls/panels/*    -> @/domains/graph/components/Graph*
   - @/domains/graph/controls/FloatingZoomControls* -> @/domains/graph/components/GraphFloatingZoomControls*
   - @/domains/graph/config-panel/index   -> @/domains/graph/components/GraphConfigPanel
   - @/domains/graph/config-panel/*       -> @/domains/graph/components/Graph*
   - @/domains/graph/node-panel/*         -> @/domains/graph/components/Graph*
   - @/domains/graph/components/{unprefixed} -> @/domains/graph/components/Graph{unprefixed}
3. Menghapus folder lama domain graph yang sudah dipindahkan ke shared/ dan components/.

Usage:
  python convert_and_repair_wave1.py --dry-run   (Lihat simulasi perubahan tanpa menulis file)
  python convert_and_repair_wave1.py             (Terapkan perubahan dan bersihkan file lama)
"""

import sys
import shutil
import posixpath
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

# Regex mencocokkan import/export dari path string relatif (../ atau ./)
IMPORT_REL_REGEX = re.compile(
    r"""(?P<prefix>\b(?:import|from|export)\s+(?:type\s+)?(?:[\w*\s{},$]+from\s+)?|import\s*\(\s*|require\s*\(\s*)"""
    r"""(?P<quote>["\x27])(?P<rel>\.[^"\x27]+)(?P=quote)"""
)

# Regex mencocokkan import alias @/domains/graph/...
ALIAS_GRAPH_REGEX = re.compile(
    r"""(?P<quote>["\x27])(?P<alias>@/domains/graph/[^"\x27]+)(?P=quote)"""
)

# Aturan pemetaan dari path lama domain graph ke path baru Wave 1
WAVE1_REMAPPINGS = [
    # services -> shared/api
    (re.compile(r"^@/domains/graph/services/(.+)$"), r"@/domains/graph/shared/api/\1"),
    # stores -> shared/stores
    (re.compile(r"^@/domains/graph/stores/(.+)$"), r"@/domains/graph/shared/stores/\1"),
    # model stores
    (re.compile(r"^@/domains/graph/model/(use\w+Store.*)$"), r"@/domains/graph/shared/stores/\1"),
    # model graphTypes
    (re.compile(r"^@/domains/graph/model/graphTypes(.*)$"), r"@/domains/graph/shared/utils/graph.types\1"),
    # model other utils
    (re.compile(r"^@/domains/graph/model/(.+)$"), r"@/domains/graph/shared/utils/\1"),
    # hooks
    (re.compile(r"^@/domains/graph/hooks/(.+)$"), r"@/domains/graph/shared/hooks/\1"),
    # layout useLayoutEngine
    (re.compile(r"^@/domains/graph/layout/useLayoutEngine(.*)$"), r"@/domains/graph/shared/hooks/useLayoutEngine\1"),
    # layout utils
    (re.compile(r"^@/domains/graph/layout/(.+)$"), r"@/domains/graph/shared/utils/\1"),
    # render utils
    (re.compile(r"^@/domains/graph/render/(.+)$"), r"@/domains/graph/shared/utils/\1"),
    # interactions ContextualToolbar
    (re.compile(r"^@/domains/graph/interactions/ContextualToolbar(.*)$"), r"@/domains/graph/components/GraphContextualToolbar\1"),
    # interactions utils
    (re.compile(r"^@/domains/graph/interactions/(.+)$"), r"@/domains/graph/shared/utils/\1"),
    # controls panels
    (re.compile(r"^@/domains/graph/controls/panels/(.+)$"), r"@/domains/graph/components/Graph\1"),
    (re.compile(r"^@/domains/graph/controls/FloatingZoomControls(.*)$"), r"@/domains/graph/components/GraphFloatingZoomControls\1"),
    # config-panel
    (re.compile(r"^@/domains/graph/config-panel/index$"), r"@/domains/graph/components/GraphConfigPanel"),
    (re.compile(r"^@/domains/graph/config-panel/(.+)$"), r"@/domains/graph/components/Graph\1"),
    # node-panel
    (re.compile(r"^@/domains/graph/node-panel/(.+)$"), r"@/domains/graph/components/Graph\1"),
    # unprefixed legacy components
    (re.compile(r"^@/domains/graph/components/(BacklinksPanel|DynamicLinkManager|FolderOverviewEditor|LinkManager|MarkdownRenderer|NodePanel)(.*)$"),
     r"@/domains/graph/components/Graph\1\2"),
]

# Folder lama yang akan dihapus setelah migrasi import selesai
OLD_GRAPH_DIRS = [
    SRC / "domains/graph/services",
    SRC / "domains/graph/stores",
    SRC / "domains/graph/hooks",
    SRC / "domains/graph/render",
    SRC / "domains/graph/layout",
    SRC / "domains/graph/interactions",
    SRC / "domains/graph/model",
    SRC / "domains/graph/node-panel",
    SRC / "domains/graph/controls",
    SRC / "domains/graph/config-panel",
]

# File komponen lama tanpa prefix 'Graph' yang sudah memiliki versi 'Graph*.tsx'
OLD_UNPREFIXED_COMPONENTS = [
    SRC / "domains/graph/components/BacklinksPanel.tsx",
    SRC / "domains/graph/components/DynamicLinkManager.tsx",
    SRC / "domains/graph/components/FolderOverviewEditor.tsx",
    SRC / "domains/graph/components/LinkManager.tsx",
    SRC / "domains/graph/components/MarkdownRenderer.tsx",
    SRC / "domains/graph/components/NodePanel.tsx",
]


def remap_graph_alias(alias: str) -> str:
    """Remap path lama graph ke canonical path Wave 1."""
    for pattern, repl in WAVE1_REMAPPINGS:
        if pattern.match(alias):
            return pattern.sub(repl, alias)
    return alias


def rel_to_alias(file_posix: str, rel_spec: str) -> str:
    """Mengubah path relatif file menjadi alias @/..."""
    base, *query = rel_spec.split("?", 1)
    file_dir = posixpath.dirname(file_posix)
    joined = posixpath.normpath(posixpath.join(file_dir, base))

    if joined.startswith("src/"):
        alias = "@/" + joined[4:]
        if query:
            alias += "?" + query[0]
        return alias
    return rel_spec


def process_file_content(file_posix: str, content: str) -> tuple[str, int]:
    """Mengubah semua relative imports menjadi @/... dan me-remap path graph lama."""
    changes = 0

    # 1. Konversi relative import menjadi @/...
    def replace_rel(match: re.Match) -> str:
        nonlocal changes
        prefix = match.group("prefix")
        quote = match.group("quote")
        rel = match.group("rel")

        alias = rel_to_alias(file_posix, rel)
        # Jika alias adalah graph, remap ke canonical Wave 1
        remapped = remap_graph_alias(alias)

        if remapped != rel:
            changes += 1
            return f"{prefix}{quote}{remapped}{quote}"
        return match.group(0)

    content = IMPORT_REL_REGEX.sub(replace_rel, content)

    # 2. Remap alias graph yang sudah ada sebelumnya
    def replace_alias(match: re.Match) -> str:
        nonlocal changes
        quote = match.group("quote")
        alias = match.group("alias")

        remapped = remap_graph_alias(alias)
        if remapped != alias:
            changes += 1
            return f"{quote}{remapped}{quote}"
        return match.group(0)

    content = ALIAS_GRAPH_REGEX.sub(replace_alias, content)

    return content, changes


def main():
    dry_run = "--dry-run" in sys.argv

    if not SRC.exists():
        print(f"ERROR: Folder 'src' tidak ditemukan di {ROOT}")
        sys.exit(1)

    mode_label = "[DRY-RUN]" if dry_run else "[APPLY]"
    print(f"=== {mode_label} Migrasi Import Relatif ke Dynamic Alias @/ & Penyelesaian Wave 1 ===")

    all_files = [f for f in SRC.rglob("*") if f.suffix in (".ts", ".tsx")]
    total_files_modified = 0
    total_import_changes = 0

    for file_path in all_files:
        rel_to_root = file_path.relative_to(ROOT).as_posix()
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"Warning: Gagal membaca {rel_to_root}: {e}")
            continue

        new_content, changes = process_file_content(rel_to_root, content)
        if changes > 0:
            total_files_modified += 1
            total_import_changes += changes
            if dry_run:
                print(f"  [DRY] {rel_to_root} ({changes} imports akan diupdate)")
            else:
                file_path.write_text(new_content, encoding="utf-8")

    print(f"\n[HASIL IMPORT]")
    print(f"  Total file diperbarui  : {total_files_modified} files")
    print(f"  Total import dikonversi: {total_import_changes} imports")

    # 3. Hapus file komponen lama yang tidak ber-prefix
    print(f"\n[PEMBERSIHAN FILE DUPLIKAT LAMA]")
    deleted_files = 0
    for old_comp in OLD_UNPREFIXED_COMPONENTS:
        if old_comp.exists():
            if dry_run:
                print(f"  [DRY] Akan menghapus file: {old_comp.relative_to(ROOT).as_posix()}")
            else:
                old_comp.unlink()
                print(f"  [DELETED FILE] {old_comp.relative_to(ROOT).as_posix()}")
            deleted_files += 1

    # 4. Hapus folder lama yang sudah dipindahkan ke shared/ dan components/
    deleted_dirs = 0
    for old_dir in OLD_GRAPH_DIRS:
        if old_dir.exists() and old_dir.is_dir():
            if dry_run:
                print(f"  [DRY] Akan menghapus folder: {old_dir.relative_to(ROOT).as_posix()}")
            else:
                shutil.rmtree(old_dir)
                print(f"  [DELETED FOLDER] {old_dir.relative_to(ROOT).as_posix()}")
            deleted_dirs += 1

    if dry_run:
        print("\nMode --dry-run selesai. Tidak ada file yang diubah di disk.")
        print("Untuk menerapkan secara nyata, jalankan: python convert_and_repair_wave1.py")
    else:
        print("\n=== MIGRASI WAVE 1 BERHASIL DITERAPKAN DENGAN ALIAS @/ ===")
        print("Silakan verifikasi dengan menjalankan:")
        print("  bun test")
        print("  bun run build:dev")


if __name__ == "__main__":
    main()
