/**
 * DatabaseSyncService - Cross-device vault synchronization
 * 
 * Manages sync between IndexedDB and cloud databases
 */

import { DatabaseAdapter, DatabaseConfig, VaultSyncData } from './DatabaseAdapter';
import { MongoDBAdapter } from './MongoDBAdapter';
import { FirebaseAdapter } from './FirebaseAdapter';

export class DatabaseSyncService {
  private adapter: DatabaseAdapter | null = null;
  private config: DatabaseConfig | null = null;
  private syncIntervals: Map<string, number> = new Map();

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('database_config');
      if (stored) {
        this.config = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load database config:', error);
    }
  }

  private saveConfig(): void {
    if (!this.config) return;
    
    try {
      localStorage.setItem('database_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save database config:', error);
    }
  }

  async setConfig(config: DatabaseConfig): Promise<boolean> {
    try {
      // Disconnect existing adapter
      if (this.adapter) {
        await this.adapter.disconnect();
      }

      // Create new adapter
      switch (config.type) {
        case 'mongodb':
          this.adapter = new MongoDBAdapter(config.config as { apiUrl: string; apiKey: string });
          break;
        case 'firebase':
          this.adapter = new FirebaseAdapter(config.config as {
            apiKey: string;
            authDomain: string;
            projectId: string;
          });
          break;
        case 'indexeddb':
          this.adapter = null; // IndexedDB is always available
          break;
        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      // Test connection
      if (this.adapter) {
        const connected = await this.adapter.connect();
        if (!connected) {
          throw new Error('Failed to connect to database');
        }
      }

      this.config = config;
      this.saveConfig();
      return true;
    } catch (error) {
      console.error('Failed to set database config:', error);
      this.adapter = null;
      return false;
    }
  }

  getConfig(): DatabaseConfig | null {
    return this.config;
  }

  isConnected(): boolean {
    if (!this.adapter) return false;
    return this.adapter.isConnected();
  }

  async syncVault(vaultData: VaultSyncData): Promise<void> {
    if (!this.adapter || !this.isConnected()) {
      console.log('DatabaseSync: No adapter configured, skipping sync');
      return;
    }

    try {
      await this.adapter.syncVault(vaultData);
      console.log('DatabaseSync: Vault synced successfully', vaultData.vaultId);
    } catch (error) {
      console.error('DatabaseSync: Sync failed', error);
      throw error;
    }
  }

  async pullVaults(userId?: string): Promise<VaultSyncData[]> {
    if (!this.adapter || !this.isConnected()) {
      return [];
    }

    try {
      return await this.adapter.getVaults(userId);
    } catch (error) {
      console.error('DatabaseSync: Pull failed', error);
      return [];
    }
  }

  async pullVault(vaultId: string): Promise<VaultSyncData | null> {
    if (!this.adapter || !this.isConnected()) {
      return null;
    }

    try {
      return await this.adapter.getVault(vaultId);
    } catch (error) {
      console.error('DatabaseSync: Pull vault failed', error);
      return null;
    }
  }

  async deleteVault(vaultId: string): Promise<void> {
    if (!this.adapter || !this.isConnected()) {
      return;
    }

    try {
      await this.adapter.deleteVault(vaultId);
    } catch (error) {
      console.error('DatabaseSync: Delete failed', error);
      throw error;
    }
  }

  startAutoSync(vaultId: string, syncFn: () => Promise<void>, intervalMinutes: number = 5): void {
    // Stop existing interval
    this.stopAutoSync(vaultId);

    // Start new interval
    const intervalMs = intervalMinutes * 60 * 1000;
    const intervalId = window.setInterval(async () => {
      try {
        await syncFn();
      } catch (error) {
        console.error('DatabaseSync: Auto-sync failed', error);
      }
    }, intervalMs);

    this.syncIntervals.set(vaultId, intervalId);
  }

  stopAutoSync(vaultId: string): void {
    const intervalId = this.syncIntervals.get(vaultId);
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
      this.syncIntervals.delete(vaultId);
    }
  }

  stopAllAutoSync(): void {
    this.syncIntervals.forEach((intervalId) => window.clearInterval(intervalId));
    this.syncIntervals.clear();
  }

  async disconnect(): Promise<void> {
    this.stopAllAutoSync();
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }
  }
}
