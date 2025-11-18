import {sha256sum} from './nodeCrypto.js';
import {versions} from './versions.js';
import {ipcRenderer} from 'electron';

function send(channel: string, message: string) {
  return ipcRenderer.invoke(channel, message);
}



// Crawler API
const crawler = {
  fetchOffers: (options?: { includeRanking?: boolean }) =>
    ipcRenderer.invoke('crawler:fetch-offers', options),
  fetchSingleRank: (offerId: string) =>
    ipcRenderer.invoke('crawler:fetch-single-rank', offerId),
  analyzeRanking: (offerId: string, buildingName?: string, price?: string) =>
    ipcRenderer.invoke('crawler:analyze-ranking', { offerId, buildingName, price }),
  cancel: () =>
    ipcRenderer.invoke('crawler:cancel'),
  onProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('crawler:progress', subscription);
    return () => ipcRenderer.removeListener('crawler:progress', subscription);
  },
};

// Offers API
const offers = {
  getAll: () =>
    ipcRenderer.invoke('offers:get-all'),
  getAdvertising: () =>
    ipcRenderer.invoke('offers:get-advertising'),
  count: () =>
    ipcRenderer.invoke('offers:count'),
  deleteAll: () =>
    ipcRenderer.invoke('offers:delete-all'),
};

// DB API
const db = {
  migrate: () =>
    ipcRenderer.invoke('db:migrate'),
};

// Batch API
const batch = {
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
  onProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('batch:progress', subscription);
    return () => ipcRenderer.removeListener('batch:progress', subscription);
  },
};

// Auth API
const auth = {
  saveCredentials: (credentials: any) =>
    ipcRenderer.invoke('auth:save-credentials', credentials),
  getCredentials: () =>
    ipcRenderer.invoke('auth:get-credentials'),
  deleteCredentials: () =>
    ipcRenderer.invoke('auth:delete-credentials'),
  hasCredentials: () =>
    ipcRenderer.invoke('auth:has-credentials'),
};

// Ad Test API
const adTest = {
  removeAd: (numberN: string) =>
    ipcRenderer.invoke('adTest:removeAd', numberN),
  modifyPrice: (params: { numberN: string; modifiedPrice?: string; modifiedRent?: string }) =>
    ipcRenderer.invoke('adTest:modifyPrice', params),
};

// Property Owner API
const propertyOwner = {
  setSession: (accessToken: string, refreshToken: string) =>
    ipcRenderer.invoke('propertyOwner:setSession', accessToken, refreshToken),
  get: (propertyName: string, dong: string, ho: string) =>
    ipcRenderer.invoke('propertyOwner:get', propertyName, dong, ho),
  save: (
    propertyName: string,
    dong: string,
    ho: string,
    verificationInfo: any,
    documentFilePath?: string,
    registerFilePath?: string,
    powerOfAttorneyFilePath?: string
  ) =>
    ipcRenderer.invoke(
      'propertyOwner:save',
      propertyName,
      dong,
      ho,
      verificationInfo,
      documentFilePath,
      registerFilePath,
      powerOfAttorneyFilePath
    ),
  delete: (propertyName: string, dong: string, ho: string) =>
    ipcRenderer.invoke('propertyOwner:delete', propertyName, dong, ho),
  deleteFile: (propertyName: string, dong: string, ho: string, fileType: 'document' | 'register' | 'powerOfAttorney') =>
    ipcRenderer.invoke('propertyOwner:deleteFile', propertyName, dong, ho, fileType),
  selectFile: () =>
    ipcRenderer.invoke('propertyOwner:selectFile'),
  downloadFile: (storageFilePath: string, saveAsName: string) =>
    ipcRenderer.invoke('propertyOwner:downloadFile', storageFilePath, saveAsName),
};

// Agency API
const agency = {
  setSession: (accessToken: string, refreshToken: string) =>
    ipcRenderer.invoke('agency:setSession', accessToken, refreshToken),
  getUserProfile: () =>
    ipcRenderer.invoke('agency:getUserProfile'),
  create: (agencyName: string, subscriptionMonths?: number) =>
    ipcRenderer.invoke('agency:create', agencyName, subscriptionMonths),
  registerMachineId: () =>
    ipcRenderer.invoke('agency:registerMachineId'),
  getCurrentMachineId: () =>
    ipcRenderer.invoke('agency:getCurrentMachineId'),
  checkSubscriptionStatus: () =>
    ipcRenderer.invoke('agency:checkSubscriptionStatus'),
  submitJoinRequest: (agencyName: string) =>
    ipcRenderer.invoke('agency:submitJoinRequest', agencyName),
  submitMachineIdRequest: () =>
    ipcRenderer.invoke('agency:submitMachineIdRequest'),
};

export {sha256sum, versions, send, crawler, offers, db, batch, auth, adTest, propertyOwner, agency};
