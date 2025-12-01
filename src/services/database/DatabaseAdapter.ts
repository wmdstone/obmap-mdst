/**
 * DatabaseAdapter - Interface for database backends
 * 
 * Provides a unified interface for syncing vault data to cloud databases
 */

export interface DatabaseConfig {
  type: 'mongodb' | 'firebase' | 'indexeddb';
  config: Record<string, any>;
}

export interface VaultSyncData {
  vaultId: string;
  name: string;
  type: 'in-memory' | 'local-folder';
  nodes: any[];
  links: any[];
  lastModified: number;
  userId?: string;
}

export interface DatabaseAdapter {
  /**
   * Initialize connection to the database
   */
  connect(): Promise<boolean>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * Sync vault data to the cloud
   */
  syncVault(vaultData: VaultSyncData): Promise<void>;

  /**
   * Get all vaults for the current user
   */
  getVaults(userId?: string): Promise<VaultSyncData[]>;

  /**
   * Get a specific vault
   */
  getVault(vaultId: string): Promise<VaultSyncData | null>;

  /**
   * Delete a vault
   */
  deleteVault(vaultId: string): Promise<void>;

  /**
   * Get last sync timestamp for a vault
   */
  getLastSync(vaultId: string): Promise<number>;
}
