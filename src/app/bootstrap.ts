/**
 * Application bootstrap
 *
 * Registers every long-lived service in the DI container so features can
 * resolve them through `useService` instead of importing singletons directly.
 */

import { container, ServiceIds } from "@/shared/di/container";
import { eventBus } from "@/shared/events/events";
import { pluginRegistry } from "@/core/system/plugins/plugin-registry";
import { getVaultManager } from "@/core/system/vault/VaultManagerSingleton";
import { VaultStorage } from "@/core/system/vault/VaultStorage";
import { vaultSyncService } from "@/core/system/vault/VaultSyncService";
import { VaultBackupService } from "@/core/system/vault/VaultBackupService";
import { GraphService } from "@/core/graph/GraphService";
import { RelationshipMapper } from "@/core/graph/RelationshipMapper";
import { ContentParser } from "@/core/system/metadata/content-parser";
import { getFileSystemService } from "@/core/system/persistence/FileSystemServiceSingleton";
import { importExportService } from "@/core/system/import-export/services/ImportExportService";
import { apiKeyService } from "@/core/shell/profile/services/ApiKeyService";
import { supabase } from "@/integrations/supabase/client";
import { commandRegistry } from "@/core/system/commands/CommandRegistry";
import { registerEditorCommands } from "@/core/editor/commands/editorCommands";
import { syncEngine } from "@/core/system/sync/SyncEngine";
import { syncCoordinator } from "@/core/system/sync/SyncCoordinator";
import { registerToggleableFeatures } from "@/core/system/plugins/feature-toggles";

let bootstrapped = false;

export function bootstrapApp(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  container.registerInstance(ServiceIds.EventBus, eventBus);
  container.registerInstance(ServiceIds.PluginRegistry, pluginRegistry);
  container.registerInstance(ServiceIds.SupabaseClient, supabase);

  container.registerInstance(ServiceIds.VaultManager, getVaultManager());
  container.register(ServiceIds.VaultStorage, () => new VaultStorage());
  container.registerInstance(ServiceIds.VaultSyncService, vaultSyncService);
  container.register(
    ServiceIds.VaultBackupService,
    () => new VaultBackupService(),
  );

  container.register(ServiceIds.GraphService, () => new GraphService());
  container.register(
    ServiceIds.RelationshipMapper,
    () => new RelationshipMapper(),
  );
  container.register(ServiceIds.ContentParser, () => new ContentParser());

  container.registerInstance(
    ServiceIds.FileSystemService,
    getFileSystemService(),
  );

  container.registerInstance(
    ServiceIds.ImportExportService,
    importExportService,
  );
  container.registerInstance(ServiceIds.ApiKeyService, apiKeyService);

  container.registerInstance(ServiceIds.CommandRegistry, commandRegistry);
  registerEditorCommands();

  // Sync engine owns dirty tracking, conflict copies and the offline queue.
  syncEngine.attachVaultManager(getVaultManager());
  container.registerInstance(ServiceIds.SyncEngine, syncEngine);
  void syncEngine.replayQueue();

  // The coordinator owns when syncs run: one auth subscription, one online
  // listener, mutex + debounce so overlapping triggers collapse into one sync.
  syncCoordinator.start();

  registerToggleableFeatures();
}
