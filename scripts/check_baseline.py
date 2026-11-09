import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
import subprocess

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_DIR = PROJECT_ROOT / "tests" / "baseline_screenshots"
ROADMAP_FILE = PROJECT_ROOT / "roadmap.md"
BASE_URL = "https://crispy-eureka-xrx5g7r5976pfpp75-8080.app.github.dev/"  # Sesuaikan jika port lokal Anda 5173 atau lainnya

TARGET_FILES = [
    "src/core/graph/GraphWorkspaceControls.tsx",
    "src/core/graph/GraphCanvas.tsx",
    "src/core/shell/workspace/SidebarPanel.tsx",
    "src/core/graph/NodePanel.tsx",
    "src/core/system/import-export/services/ImportExportService.ts",
    "src/core/system/vault/VaultManager.ts",
    "src/core/shell/workspace/VaultSessionContext.tsx",
]

def count_lines(filepath: Path) -> int:
    if not filepath.exists():
        return 0
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        return sum(1 for _ in f)

def update_roadmap(file_stats: dict, total_lines: int):
    roadmap_content = ROADMAP_FILE.read_text(encoding="utf-8")
    header_marker = "## Refactoring Baseline (Fase 0)"

    stats_lines = "\n".join([f"  - `{path}`: {lines} baris" for path, lines in file_stats.items()])
    
    baseline_section = f"""

{header_marker}

- Tanggal Baseline: 2026-10-11
- Test Status: 8 test files, 64 tests passed (Vitest)
- Target Ukuran 7 File:
{stats_lines}
- Total Baris Awal: {total_lines} baris
- Target Akhir: < 2000 baris total untuk file orkestrator tersebut.
"""

    if header_marker in roadmap_content:
        print("[i] Bagian Refactoring Baseline sudah ada di roadmap.md (tidak diduplikasi).")
    else:
        with open(ROADMAP_FILE, "a", encoding="utf-8") as f:
            f.write(baseline_section)
        print("[✓] Berhasil menambahkan catatan baseline ke roadmap.md!")

async def capture_screenshots():
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        print(f"[...] Membuka {BASE_URL} untuk capture acuan...")
        try:
            await page.goto(BASE_URL, wait_until="networkidle", timeout=15000)
        except Exception:
            await page.goto(BASE_URL, wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)

        # 1. Screenshot Full Workspace
        await page.screenshot(path=str(SNAPSHOT_DIR / "01_workspace_initial.png"))
        print("[✓] Screenshot tersimpan: tests/baseline_screenshots/01_workspace_initial.png")

        # 2. Screenshot Toolbar Graph
        controls = page.locator("nav, [data-testid='graph-controls'], .graph-controls").first
        if await controls.count() > 0:
            await controls.screenshot(path=str(SNAPSHOT_DIR / "02_controls_toolbar.png"))
            print("[✓] Screenshot tersimpan: tests/baseline_screenshots/02_controls_toolbar.png")

        # 3. Screenshot Sidebar
        sidebar = page.locator("aside, [data-testid='sidebar']").first
        if await sidebar.count() > 0:
            await sidebar.screenshot(path=str(SNAPSHOT_DIR / "03_sidebar.png"))
            print("[✓] Screenshot tersimpan: tests/baseline_screenshots/03_sidebar.png")

        await browser.close()

def main():
    print("=== [1/3] Menghitung Baris 7 File Target ===")
    file_stats = {}
    total_lines = 0
    for rel_path in TARGET_FILES:
        full_path = PROJECT_ROOT / rel_path
        lines = count_lines(full_path)
        file_stats[rel_path] = lines
        total_lines += lines
        print(f"  • {rel_path}: {lines} baris")
    print(f"  Total: {total_lines} baris")

    print("\n=== [2/3] Mengambil Visual Screenshot Acuan ===")
    asyncio.run(capture_screenshots())

    print("\n=== [3/3] Memperbarui roadmap.md ===")
    update_roadmap(file_stats, total_lines)
    print("\n[OK] Fase 0 Selesai Sempurna!")

if __name__ == "__main__":
    main()