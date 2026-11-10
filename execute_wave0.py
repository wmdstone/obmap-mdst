#!/usr/bin/env python3
"""
Wave 0 Restructuring Script: Foundation of src/global/
- Migrates shadcn UI, Supabase integrations, global hooks, events, and utils into src/global/
- Updates internal and project-wide imports to canonical @/global/... paths
- Installs backward-compatibility re-export shims in legacy locations
- Fully compatible with Windows (Git Bash), macOS, and Linux
"""

import os
import sys
import re
import shutil
from pathlib import Path

DRY_RUN = "--dry-run" in sys.argv
APPLY = "--apply" in sys.argv or not DRY_RUN

def log(msg: str, color: str = "32"):
    print(f"\033[{color}m{msg}\033[0m")

def warn(msg: str):
    print(f"\033[33m[WARN] {msg}\033[0m")

def info(msg: str):
    print(f"\033[36m[INFO] {msg}\033[0m")

ROOT = Path(".").resolve()
SRC = ROOT / "src"
GLOBAL = SRC / "global"

if not SRC.exists():
    log("Error: Folder 'src' tidak ditemukan. Jalankan script ini dari root project!", "31")
    sys.exit(1)

log(f"\n🚀 Memulai Wave 0 Restructuring (Mode: {'DRY RUN' if DRY_RUN else 'APPLY'})...\n", "35")

# 1. Buat direktori tujuan di src/global/
target_dirs = [
    GLOBAL / "ui",
    GLOBAL / "api",
    GLOBAL / "hooks",
    GLOBAL / "stores",
    GLOBAL / "utils",
    GLOBAL / "components",
]

for d in target_dirs:
    if not DRY_RUN:
        d.mkdir(parents=True, exist_ok=True)
    info(f"Directory ready: {d.relative_to(ROOT)}")

# 2. Pemetaan file spesifik (Source -> Destination -> Shim content)
file_migration_map = [
    # API / Supabase
    (
        SRC / "integrations" / "supabase" / "client.ts",
        GLOBAL / "api" / "supabaseClient.ts",
        'export * from "@/global/api/supabaseClient";\nexport { supabase } from "@/global/api/supabaseClient";\n',
    ),
    (
        SRC / "integrations" / "supabase" / "types.ts",
        GLOBAL / "api" / "supabaseTypes.ts",
        'export * from "@/global/api/supabaseTypes";\nexport type { Database } from "@/global/api/supabaseTypes";\n',
    ),
    (
        SRC / "integrations" / "supabase" / "previewAuthStorage.ts",
        GLOBAL / "api" / "previewAuthStorage.ts",
        'export * from "@/global/api/previewAuthStorage";\n',
    ),
    (
        SRC / "shared" / "lib" / "untypedSupabase.ts",
        GLOBAL / "api" / "untypedSupabase.ts",
        'export * from "@/global/api/untypedSupabase";\n',
    ),

    # Hooks
    (
        SRC / "shared" / "hooks" / "useMobile.tsx",
        GLOBAL / "hooks" / "useMobile.tsx",
        'export * from "@/global/hooks/useMobile";\n',
    ),
    (
        SRC / "shared" / "hooks" / "useToast.ts",
        GLOBAL / "hooks" / "useToast.ts",
        'export * from "@/global/hooks/useToast";\nexport { useToast, toast } from "@/global/hooks/useToast";\n',
    ),

    # Stores / Reactive Core
    (
        SRC / "shared" / "events" / "events.ts",
        GLOBAL / "stores" / "events.ts",
        'export * from "@/global/stores/events";\n',
    ),

    # Utils / Pure helpers & DI
    (
        SRC / "shared" / "lib" / "cn.ts",
        GLOBAL / "utils" / "cn.ts",
        'export * from "@/global/utils/cn";\nexport { cn } from "@/global/utils/cn";\n',
    ),
    (
        SRC / "shared" / "lib" / "color-engine.ts",
        GLOBAL / "utils" / "color-engine.ts",
        'export * from "@/global/utils/color-engine";\n',
    ),
    (
        SRC / "shared" / "lib" / "color-utils.ts",
        GLOBAL / "utils" / "color-utils.ts",
        'export * from "@/global/utils/color-utils";\n',
    ),
    (
        SRC / "shared" / "lib" / "fuzzy.ts",
        GLOBAL / "utils" / "fuzzy.ts",
        'export * from "@/global/utils/fuzzy";\n',
    ),
    (
        SRC / "shared" / "di" / "container.ts",
        GLOBAL / "utils" / "container.ts",
        'export * from "@/global/utils/container";\n',
    ),
    (
        SRC / "shared" / "di" / "useService.ts",
        GLOBAL / "utils" / "useService.ts",
        'export * from "@/global/utils/useService";\n',
    ),

    # Global Components
    (
        SRC / "shared" / "components" / "ErrorBoundary.tsx",
        GLOBAL / "components" / "ErrorBoundary.tsx",
        'export * from "@/global/components/ErrorBoundary";\nexport { ErrorBoundary } from "@/global/components/ErrorBoundary";\n',
    ),
    (
        SRC / "shared" / "components" / "PWAInstallPrompt.tsx",
        GLOBAL / "components" / "PWAInstallPrompt.tsx",
        'export * from "@/global/components/PWAInstallPrompt";\nexport { PWAInstallPrompt } from "@/global/components/PWAInstallPrompt";\n',
    ),
]

# 3. Migrasikan seluruh UI components (52 files) dari src/shared/ui/
shared_ui_dir = SRC / "shared" / "ui"
if shared_ui_dir.exists():
    for ui_file in sorted(shared_ui_dir.glob("*.tsx")):
        dest_file = GLOBAL / "ui" / ui_file.name
        shim_content = f'export * from "@/global/ui/{ui_file.stem}";\n'
        file_migration_map.append((ui_file, dest_file, shim_content))

log(f"\n📦 Memproses {len(file_migration_map)} file kanonikal ke src/global/...")

for src_path, dest_path, shim_content in file_migration_map:
    if not src_path.exists():
        warn(f"File sumber tidak ditemukan: {src_path}")
        continue

    content = src_path.read_text(encoding="utf-8")

    # Update path internal di dalam file yang dipindahkan
    content = re.sub(r'@/shared/lib/cn', r'@/global/utils/cn', content)
    content = re.sub(r'@/shared/lib', r'@/global/utils', content)
    content = re.sub(r'@/shared/hooks/useToast', r'@/global/hooks/useToast', content)
    content = re.sub(r'@/shared/hooks/useMobile', r'@/global/hooks/useMobile', content)
    content = re.sub(r'@/shared/ui/', r'@/global/ui/', content)
    content = re.sub(r'@/integrations/supabase/types', r'@/global/api/supabaseTypes', content)
    content = re.sub(r'@/integrations/supabase/previewAuthStorage', r'@/global/api/previewAuthStorage', content)
    content = re.sub(r'@/integrations/supabase/client', r'@/global/api/supabaseClient', content)

    if not DRY_RUN:
        dest_path.write_text(content, encoding="utf-8")
        # Tulis shim di lokasi lama untuk backward compatibility
        src_path.write_text(shim_content, encoding="utf-8")

    info(f"  ✓ {src_path.relative_to(ROOT)} -> {dest_path.relative_to(ROOT)} (Shim installed)")

# 4. Buat barrel index.ts di setiap subfolder global
barrels = {
    GLOBAL / "api" / "index.ts": (
        'export * from "./supabaseClient";\n'
        'export * from "./supabaseTypes";\n'
        'export * from "./previewAuthStorage";\n'
        'export * from "./untypedSupabase";\n'
    ),
    GLOBAL / "hooks" / "index.ts": (
        'export * from "./useMobile";\n'
        'export * from "./useToast";\n'
    ),
    GLOBAL / "stores" / "index.ts": (
        'export * from "./events";\n'
    ),
    GLOBAL / "utils" / "index.ts": (
        'export * from "./cn";\n'
        'export * from "./color-engine";\n'
        'export * from "./color-utils";\n'
        'export * from "./fuzzy";\n'
        'export * from "./container";\n'
        'export * from "./useService";\n'
    ),
    GLOBAL / "components" / "index.ts": (
        'export * from "./ErrorBoundary";\n'
        'export * from "./PWAInstallPrompt";\n'
    ),
}

for barrel_path, barrel_content in barrels.items():
    if not DRY_RUN:
        barrel_path.write_text(barrel_content, encoding="utf-8")
    info(f"  ✓ Barrel generated: {barrel_path.relative_to(ROOT)}")

# 5. Global Import Rewriter across all ts/tsx files in src/
log("\n🔄 Memperbarui import di seluruh proyek ke @/global/...", "33")

import_rules = [
    # UI components
    (re.compile(r'@/shared/ui/([a-zA-Z0-9_-]+)'), r'@/global/ui/\1'),
    # Utils & Helpers
    (re.compile(r'@/shared/lib/cn'), r'@/global/utils/cn'),
    (re.compile(r'@/shared/lib/color-engine'), r'@/global/utils/color-engine'),
    (re.compile(r'@/shared/lib/color-utils'), r'@/global/utils/color-utils'),
    (re.compile(r'@/shared/lib/fuzzy'), r'@/global/utils/fuzzy'),
    (re.compile(r'@/shared/lib/untypedSupabase'), r'@/global/api/untypedSupabase'),
    (re.compile(r'@/shared/lib\b'), r'@/global/utils'),
    # DI
    (re.compile(r'@/shared/di/container'), r'@/global/utils/container'),
    (re.compile(r'@/shared/di/useService'), r'@/global/utils/useService'),
    (re.compile(r'@/shared/di\b'), r'@/global/utils'),
    # Hooks
    (re.compile(r'@/shared/hooks/useToast'), r'@/global/hooks/useToast'),
    (re.compile(r'@/shared/hooks/useMobile'), r'@/global/hooks/useMobile'),
    # Events
    (re.compile(r'@/shared/events/events'), r'@/global/stores/events'),
    (re.compile(r'@/shared/events\b'), r'@/global/stores/events'),
    # Supabase Integrations
    (re.compile(r'@/integrations/supabase/client'), r'@/global/api/supabaseClient'),
    (re.compile(r'@/integrations/supabase/types'), r'@/global/api/supabaseTypes'),
    (re.compile(r'@/integrations/supabase/previewAuthStorage'), r'@/global/api/previewAuthStorage'),
    # Components
    (re.compile(r'@/shared/components/ErrorBoundary'), r'@/global/components/ErrorBoundary'),
    (re.compile(r'@/shared/components/PWAInstallPrompt'), r'@/global/components/PWAInstallPrompt'),
]

files_updated = 0
total_replacements = 0

all_ts_files = list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx"))

for file_path in all_ts_files:
    # Jangan modifikasi file shim di shared/ui yang baru saja dibuat
    if file_path.is_relative_to(SRC / "shared" / "ui") or file_path.is_relative_to(SRC / "integrations" / "supabase"):
        continue

    try:
        original = file_path.read_text(encoding="utf-8")
    except Exception as e:
        warn(f"Gagal membaca {file_path}: {e}")
        continue

    modified = original
    rep_count = 0

    for pattern, replacement in import_rules:
        new_content, count = pattern.subn(replacement, modified)
        if count > 0:
            modified = new_content
            rep_count += count

    if rep_count > 0:
        files_updated += 1
        total_replacements += rep_count
        if not DRY_RUN:
            file_path.write_text(modified, encoding="utf-8")
        info(f"  ✓ {file_path.relative_to(ROOT)} ({rep_count} imports updated)")

log(f"\n🎉 Wave 0 Selesai!", "32")
log(f"   - File kanonikal global dibuat: {len(file_migration_map)}")
log(f"   - File proyek yang diperbarui importnya: {files_updated}")
log(f"   - Total path import yang dialihkan: {total_replacements}")

if DRY_RUN:
    log("\n[!] Mode DRY RUN selesai. Untuk menerapkan perubahan secara riil, jalankan:\n    python execute_wave0.py\n", "33")
else:
    log("\n[✓] Silakan verifikasi build dengan:\n    bun test\n    bun run build:dev\n", "32")
