import {sha256sum} from './nodeCrypto.js';
import {versions} from './versions.js';
import {ipcRenderer} from 'electron';

function send(channel: string, message: string) {
  return ipcRenderer.invoke(channel, message);
}

// Crawler API
const crawler = {
  // 매물 크롤링
  fetchOffers: (options?: { includeRanking?: boolean }) =>
    ipcRenderer.invoke('crawler:fetch-offers', options),

  // 크롤링 취소
  cancel: () =>
    ipcRenderer.invoke('crawler:cancel'),

  // 진행 상황 수신
  onProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('crawler:progress', subscription);
    return () => ipcRenderer.removeListener('crawler:progress', subscription);
  },
};

// Offers API
const offers = {
  // 모든 매물 조회
  getAll: () =>
    ipcRenderer.invoke('offers:get-all'),

  // 광고중인 매물만 조회
  getAdvertising: () =>
    ipcRenderer.invoke('offers:get-advertising'),

  // 매물 개수 조회
  count: () =>
    ipcRenderer.invoke('offers:count'),
};

export {sha256sum, versions, send, crawler, offers};
