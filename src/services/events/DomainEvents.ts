/**
 * Domain Events - Event Sourcing Pattern
 * Events emitted by the Persistence Service and consumed by the Graph Service
 */

export enum EventType {
  VAULT_OPENED = 'VAULT_OPENED',
  NOTE_CREATED = 'NOTE_CREATED',
  NOTE_UPDATED = 'NOTE_UPDATED',
  NOTE_DELETED = 'NOTE_DELETED',
  FOLDER_CREATED = 'FOLDER_CREATED',
  FOLDER_DELETED = 'FOLDER_DELETED',
  NOTE_SYNC_REQUESTED = 'NOTE_SYNC_REQUESTED',
  VAULT_SYNC_COMPLETE = 'VAULT_SYNC_COMPLETE',
  LINK_DISCOVERED = 'LINK_DISCOVERED',
}

export interface DomainEvent {
  type: EventType;
  timestamp: number;
  payload: any;
}

export interface VaultOpenedEvent extends DomainEvent {
  type: EventType.VAULT_OPENED;
  payload: {
    vaultName: string;
    rootHandle: FileSystemDirectoryHandle;
  };
}

export interface NoteCreatedEvent extends DomainEvent {
  type: EventType.NOTE_CREATED;
  payload: {
    id: string;
    name: string;
    content: string;
    path: string[];
    parentId: string | null;
  };
}

export interface NoteUpdatedEvent extends DomainEvent {
  type: EventType.NOTE_UPDATED;
  payload: {
    id: string;
    content: string;
  };
}

export interface NoteSyncRequestedEvent extends DomainEvent {
  type: EventType.NOTE_SYNC_REQUESTED;
  payload: {
    path: string[];
    content: string;
  };
}

export interface VaultSyncCompleteEvent extends DomainEvent {
  type: EventType.VAULT_SYNC_COMPLETE;
  payload: {
    synced: number;
    failed: number;
  };
}

type EventCallback = (event: DomainEvent) => void;

/**
 * Event Bus - Decouples Persistence Service from Graph Service
 */
class EventBus {
  private listeners: Map<EventType, Set<EventCallback>> = new Map();

  subscribe(eventType: EventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  emit(event: DomainEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => callback(event));
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
