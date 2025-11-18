import * as exports from './index.js';
import { crawler, offers, adTest, agency, auth, propertyOwner, batch, db } from './index.js';
import {contextBridge} from 'electron';

const isExport = (key: string): key is keyof typeof exports => Object.hasOwn(exports, key);

for (const exportsKey in exports) {
  if (isExport(exportsKey)) {
    contextBridge.exposeInMainWorld(btoa(exportsKey), exports[exportsKey]);
  }
}

contextBridge.exposeInMainWorld("crawler", crawler)
contextBridge.exposeInMainWorld("offers", offers)
contextBridge.exposeInMainWorld('auth', auth)
contextBridge.exposeInMainWorld('adTest', adTest)
contextBridge.exposeInMainWorld('agency', agency)
contextBridge.exposeInMainWorld('propertyOwner', propertyOwner)
contextBridge.exposeInMainWorld('batch', batch)
contextBridge.exposeInMainWorld('db', db)
// Re-export for tests
export * from './index.js';
