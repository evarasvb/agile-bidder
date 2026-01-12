// Chrome Storage Wrapper for FirmaVB Extension
import type { StorageData, ExtensionSettings, ClienteInfo, MatchOportunidad } from './types';

const STORAGE_KEYS = {
  API_KEY: 'fvb_api_key',
  CLIENTE_INFO: 'fvb_cliente_info',
  MATCHES: 'fvb_matches',
  LAST_SYNC: 'fvb_last_sync',
  SETTINGS: 'fvb_settings'
} as const;

const DEFAULT_SETTINGS: ExtensionSettings = {
  autoSync: true,
  syncInterval: 15, // minutes
  notifications: true,
  autoFillConfirm: true
};

class StorageManager {
  // Get all stored data
  async getAll(): Promise<StorageData> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        resolve({
          apiKey: result[STORAGE_KEYS.API_KEY],
          clienteInfo: result[STORAGE_KEYS.CLIENTE_INFO],
          matches: result[STORAGE_KEYS.MATCHES],
          lastSync: result[STORAGE_KEYS.LAST_SYNC],
          settings: result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS
        });
      });
    });
  }

  // API Key
  async getApiKey(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.API_KEY, (result) => {
        resolve(result[STORAGE_KEYS.API_KEY] || null);
      });
    });
  }

  async setApiKey(apiKey: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: apiKey }, resolve);
    });
  }

  async clearApiKey(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(STORAGE_KEYS.API_KEY, resolve);
    });
  }

  // Cliente Info
  async getClienteInfo(): Promise<ClienteInfo | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.CLIENTE_INFO, (result) => {
        resolve(result[STORAGE_KEYS.CLIENTE_INFO] || null);
      });
    });
  }

  async setClienteInfo(info: ClienteInfo): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.CLIENTE_INFO]: info }, resolve);
    });
  }

  // Matches
  async getMatches(): Promise<MatchOportunidad[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.MATCHES, (result) => {
        resolve(result[STORAGE_KEYS.MATCHES] || []);
      });
    });
  }

  async setMatches(matches: MatchOportunidad[]): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        [STORAGE_KEYS.MATCHES]: matches,
        [STORAGE_KEYS.LAST_SYNC]: new Date().toISOString()
      }, resolve);
    });
  }

  // Last Sync
  async getLastSync(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.LAST_SYNC, (result) => {
        resolve(result[STORAGE_KEYS.LAST_SYNC] || null);
      });
    });
  }

  // Settings
  async getSettings(): Promise<ExtensionSettings> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
        resolve(result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS);
      });
    });
  }

  async setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated }, resolve);
    });
  }

  // Clear all data (logout)
  async clearAll(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }
}

export const storage = new StorageManager();
export default storage;
