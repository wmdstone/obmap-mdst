/**
 * MongoDBAdapter - MongoDB Atlas/Compass integration
 * 
 * Provides sync to MongoDB through a backend API
 */

import { DatabaseAdapter, VaultSyncData } from './DatabaseAdapter';

export class MongoDBAdapter implements DatabaseAdapter {
  private connected: boolean = false;
  private apiUrl: string;
  private apiKey: string;

  constructor(config: { apiUrl: string; apiKey: string }) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
  }

  async connect(): Promise<boolean> {
    try {
      console.log('MongoDBAdapter: Testing connection');
      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      this.connected = response.ok;
      return this.connected;
    } catch (error) {
      console.error('MongoDBAdapter: Connection failed', error);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async syncVault(vaultData: VaultSyncData): Promise<void> {
    if (!this.connected) throw new Error('Not connected to MongoDB');

    const response = await fetch(`${this.apiUrl}/vaults`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vaultData),
    });

    if (!response.ok) {
      throw new Error(`MongoDB sync failed: ${response.statusText}`);
    }
  }

  async getVaults(userId?: string): Promise<VaultSyncData[]> {
    if (!this.connected) throw new Error('Not connected to MongoDB');

    const url = userId 
      ? `${this.apiUrl}/vaults?userId=${userId}`
      : `${this.apiUrl}/vaults`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch vaults: ${response.statusText}`);
    }

    return await response.json();
  }

  async getVault(vaultId: string): Promise<VaultSyncData | null> {
    if (!this.connected) throw new Error('Not connected to MongoDB');

    const response = await fetch(`${this.apiUrl}/vaults/${vaultId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Failed to fetch vault: ${response.statusText}`);
    }

    return await response.json();
  }

  async deleteVault(vaultId: string): Promise<void> {
    if (!this.connected) throw new Error('Not connected to MongoDB');

    const response = await fetch(`${this.apiUrl}/vaults/${vaultId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete vault: ${response.statusText}`);
    }
  }

  async getLastSync(vaultId: string): Promise<number> {
    if (!this.connected) throw new Error('Not connected to MongoDB');

    const response = await fetch(`${this.apiUrl}/vaults/${vaultId}/sync`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return 0;

    const data = await response.json();
    return data.lastSync || 0;
  }
}
