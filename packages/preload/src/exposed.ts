import * as exports from './index.js';
import {contextBridge, ipcRenderer} from 'electron';

const isExport = (key: string): key is keyof typeof exports => Object.hasOwn(exports, key);

for (const exportsKey in exports) {
  if (isExport(exportsKey)) {
    contextBridge.exposeInMainWorld(btoa(exportsKey), exports[exportsKey]);
  }
}

// Crawler API
contextBridge.exposeInMainWorld('crawler', {
  fetchOffers: (options?: { includeRanking?: boolean }) =>
    ipcRenderer.invoke('crawler:fetch-offers', options),
  cancel: () =>
    ipcRenderer.invoke('crawler:cancel'),
  onProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('crawler:progress', subscription);
    return () => ipcRenderer.removeListener('crawler:progress', subscription);
  },
});

// Offers API
contextBridge.exposeInMainWorld('offers', {
  getAll: () =>
    ipcRenderer.invoke('offers:get-all'),
  getAdvertising: () =>
    ipcRenderer.invoke('offers:get-advertising'),
  count: () =>
    ipcRenderer.invoke('offers:count'),
  deleteAll: () =>
    ipcRenderer.invoke('offers:delete-all'),
});

// DB API
contextBridge.exposeInMainWorld('db', {
  migrate: () =>
    ipcRenderer.invoke('db:migrate'),
});

// Batch API
contextBridge.exposeInMainWorld('batch', {
  create: (request: any) =>
    ipcRenderer.invoke('batch:create', request),
  getAll: () =>
    ipcRenderer.invoke('batch:get-all'),
  getDetail: (batchId: number) =>
    ipcRenderer.invoke('batch:get-detail', batchId),
  delete: (batchId: number) =>
    ipcRenderer.invoke('batch:delete', batchId),
  execute: (batchId: number) =>
    ipcRenderer.invoke('batch:execute', batchId),
  retry: (batchId: number) =>
    ipcRenderer.invoke('batch:retry', batchId),
});

// Auth API
contextBridge.exposeInMainWorld('auth', {
  saveCredentials: (credentials: any) =>
    ipcRenderer.invoke('auth:save-credentials', credentials),
  getCredentials: () =>
    ipcRenderer.invoke('auth:get-credentials'),
  deleteCredentials: () =>
    ipcRenderer.invoke('auth:delete-credentials'),
  hasCredentials: () =>
    ipcRenderer.invoke('auth:has-credentials'),
});

// Re-export for tests
export * from './index.js';
