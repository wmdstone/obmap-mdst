#!/usr/bin/env python3
"""
finish_wave1_final_fix.py

Menyelesaikan 5% sisa Wave 1:
1. Memperbaiki seluruh sisa import internal di shared/utils, shared/hooks, shared/stores.
2. Menyelaraskan pemanggilan komponen dengan prefix 'Graph*'.
3. Menyesuaikan mocking localStorage di VaultManager.test.ts agar 100% kompatibel dengan Bun.
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

REPLACEMENTS = [
    # 1. graphTypes -> graph.types
    (re.compile(r"@/domains/graph/shared/(?:model|stores|utils)/graphTypes\b"), "@/domains/graph/shared/utils/graph.types"),
    
    # 2. Path model lama yang sekarang ada di shared/utils
    (re.compile(r"@/domains/graph/shared/model/buildGraphProjection\b"), "@/domains/graph/shared/utils/buildGraphProjection"),
    (re.compile(r"@/domains/graph/shared/model/hierarchyColors\b"), "@/domains/graph/shared/utils/hierarchyColors"),
    (re.compile(r"@/domains/graph/shared/model/atmosphereConfig\b"), "@/domains/graph/shared/utils/atmosphereConfig"),
    (re.compile(r"@/domains/graph/shared/model/hierarchyTraversal\b"), "@/domains/graph/shared/utils/hierarchyTraversal"),
    
    # 3. Path model lama yang sekarang ada di shared/stores
    (re.compile(r"@/domains/graph/shared/model/useGraphInteractionStore\b"), "@/domains/graph/shared/stores/useGraphInteractionStore"),
    (re.compile(r"@/domains/graph/shared/model/useLeafGraphConfigStore\b"), "@/domains/graph/shared/stores/useLeafGraphConfigStore"),
    (re.compile(r"@/domains/graph/shared/stores/atmosphereConfig\b"), "@/domains/graph/shared/utils/atmosphereConfig"),

    # 4. Path render lama yang sekarang ada di shared/utils
    (re.compile(r"@/domains/graph/shared/render/theme\b"), "@/domains/graph/shared/utils/theme"),
    (re.compile(r"@/domains/graph/shared/render/cosmicAtmosphere\b"), "@/domains/graph/shared/utils/cosmicAtmosphere"),
    (re.compile(r"@/domains/graph/shared/render/drawDecorations\b"), "@/domains/graph/shared/utils/drawDecorations"),
    (re.compile(r"@/domains/graph/shared/render/drawLink\b"), "@/domains/graph/shared/utils/drawLink"),
    (re.compile(r"@/domains/graph/shared/render/drawNode\b"), "@/domains/graph/shared/utils/drawNode"),
    (re.compile(r"@/domains/graph/shared/render/textLayout\b"), "@/domains/graph/shared/utils/textLayout"),

    # 5. Path layout/interactions lama yang sekarang ada di shared/utils
    (re.compile(r"@/domains/graph/shared/layout/layoutCategory\b"), "@/domains/graph/shared/utils/layoutCategory"),
    (re.compile(r"@/domains/graph/shared/layout/layoutMath\b"), "@/domains/graph/shared/utils/layoutMath"),
    (re.compile(r"@/domains/graph/shared/layout/transitionController\b"), "@/domains/graph/shared/utils/transitionController"),
    (re.compile(r"@/domains/graph/shared/interactions/dragReparent\b"), "@/domains/graph/shared/utils/dragReparent"),

    # 6. Algoritma layout di useLayoutEngine yang berada di shared/utils
    (re.compile(r"@/domains/graph/shared/hooks/(mindmap|timeline|fishbone|freeForce|networkLayouts|treeLayouts|subtreeCompose)\b"), r"@/domains/graph/shared/utils/\1"),

    # 7. Penyelarasan komponen dengan prefix Graph
    (re.compile(r"@/domains/graph/components/(CollapsibleSection|ColorPicker|NodeStylingTab|LinkStylingTab|AnalyticsTab|HierarchyColorControls|ColorEngineControls|AtmosphereControls|LayoutEngineTab)\b"), r"@/domains/graph/components/Graph\1"),
    (re.compile(r"@/domains/graph/components/GraphNodeBreadcrumBar\b"), "@/domains/graph/components/GraphNodeBreadcrumbBar"),
]


def fix_imports():
    print("=== [1/2] Memperbaiki Sisa Import Domain Graph ===")
    modified_count = 0

    for file_path in SRC.rglob("*.ts*"):
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception as e:
            continue

        new_content = content
        for pattern, repl in REPLACEMENTS:
            new_content = pattern.sub(repl, new_content)

        if new_content != content:
            file_path.write_text(new_content, encoding="utf-8")
            print(f"  [REPAIRED] {file_path.relative_to(ROOT).as_posix()}")
            modified_count += 1

    print(f"Selesai: {modified_count} file berhasil diperbaiki.")


def fix_bun_test():
    print("\n=== [2/2] Memperbaiki Mocking Test di VaultManager.test.ts untuk Bun ===")
    test_file = SRC / "domains/vault/__tests__/VaultManager.test.ts"
    if not test_file.exists():
        print("  Info: File VaultManager.test.ts tidak ditemukan, dilewati.")
        return

    content = test_file.read_text(encoding="utf-8")
    
    old_stub_pattern = re.compile(
        r"vi\.stubGlobal\s*\(\s*['\"]localStorage['\"]\s*,\s*\{[\s\S]*?\}\s*\);",
        re.MULTILINE
    )

    new_stub = """const mockLocalStorage = {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, val: string) => localStore.set(key, val),
      removeItem: (key: string) => localStore.delete(key),
      clear: () => localStore.clear(),
      length: 0,
      key: () => null,
    };
    if (typeof vi !== 'undefined' && typeof (vi as any).stubGlobal === 'function') {
      (vi as any).stubGlobal('localStorage', mockLocalStorage);
    } else {
      Object.defineProperty(globalThis, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true,
      });
    }"""

    if old_stub_pattern.search(content):
        updated_content = old_stub_pattern.sub(new_stub, content)
        test_file.write_text(updated_content, encoding="utf-8")
        print("  [REPAIRED] VaultManager.test.ts disesuaikan untuk Bun test.")
    else:
        print("  Info: VaultManager.test.ts sudah menggunakan format kompatibel.")


def verify_sanity():
    print("\n=== [VERIFIKASI INTEGRITAS IMPORT] ===")
    import_regex = re.compile(r"""(?:from|import)\s+["\x27](@/domains/graph/[^"\x27]+)["\x27]""")
    missing = []

    for f in SRC.rglob("*.ts*"):
        text = f.read_text(encoding="utf-8", errors="ignore")
        for m in import_regex.finditer(text):
            target = m.group(1)
            rel_path = SRC / target[len("@/"):]
            found = False
            for ext in ["", ".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"]:
                candidate = Path(str(rel_path) + ext)
                if candidate.exists() and not candidate.is_dir():
                    found = True
                    break
            if not found:
                missing.append((f.relative_to(ROOT).as_posix(), target))

    if missing:
        print(f"PERINGATAN: Ditemukan {len(missing)} import yang belum selesai:")
        for src_f, target in missing:
            print(f"  - {src_f} -> {target}")
    else:
        print("SEMUA IMPORT DOMAIN GRAPH 100% VALID DAN TERHUBUNG!")


def main():
    if not SRC.exists():
        print(f"ERROR: Folder src tidak ditemukan di {ROOT}")
        sys.exit(1)

    fix_imports()
    fix_bun_test()
    verify_sanity()

    print("\n=== REPARASI SELESAI ===")
    print("Sekarang jalankan:")
    print("  bun test")
    print("  bun run build:dev")


if __name__ == "__main__":
    main()