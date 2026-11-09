/**
 * Application bootstrap
 *
 * Registers every long-lived service in the DI container so features can
 * resolve them through `useService` instead of importing singletons directly.
 */

import { container, ServiceIds } from "@/shared/di/container";
import { eventBus } from "@/shared/events/events";
import { pluginRegistry } from "@/domains/settings/plugins/plugin-registry";
import { getVaultManager } from "@/domains/vault/services/VaultManagerSingleton";
import { VaultStorage } from "@/domains/vault/services/VaultStorage";
import { vaultSyncService } from "@/domains/vault/services/VaultSyncService";
import { VaultBackupService } from "@/domains/vault/services/VaultBackupService";
import { GraphService } from "@/domains/graph/services/GraphService";
import { RelationshipMapper } from "@/domains/graph/services/RelationshipMapper";
import { ContentParser } from "@/domains/metadata/content-parser";
import { getFileSystemService } from "@/domains/vault/persistence/FileSystemServiceSingleton";
import { importExportService } from "@/domains/vault/import-export/services/ImportExportService";
import { apiKeyService } from "@/domains/settings/profile/services/ApiKeyService";
import { supabase } from "@/integrations/supabase/client";
import { commandRegistry } from "@/domains/workspace/commands/CommandRegistry";
import { registerEditorCommands } from "@/domains/editor/commands/editorCommands";
import { syncEngine } from "@/domains/sync/SyncEngine";
import { syncCoordinator } from "@/domains/sync/SyncCoordinator";
import { registerToggleableFeatures } from "@/domains/settings/plugins/feature-toggles";

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
