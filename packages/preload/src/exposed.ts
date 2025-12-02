import * as exports from './index.js';
import { api } from './index.js';
import {contextBridge} from 'electron';

const isExport = (key: string): key is keyof typeof exports => Object.hasOwn(exports, key);

// sha256sum, versions, send 등 함수는 기존 방식으로 expose (base64 인코딩)
for (const exportsKey in exports) {
  if (isExport(exportsKey) && exportsKey !== 'api') {
    contextBridge.exposeInMainWorld(btoa(exportsKey), exports[exportsKey]);
  }
}

// API 객체들은 반복문으로 expose
for (const [apiName, apiObject] of Object.entries(api)) {
  contextBridge.exposeInMainWorld(apiName, apiObject);
}
// Re-export for tests
export * from './index.js';
