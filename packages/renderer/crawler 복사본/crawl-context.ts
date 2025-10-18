import { GET_INIT_DATA_CRAWL, UPLOAD_ADVERTISEMENT_CRAWL } from "./crawl-channels";

export function exposeCrawlerContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("crawler", {
    getInitData: () => ipcRenderer.invoke(GET_INIT_DATA_CRAWL),
    uploadAdvertisement: (data: any) => ipcRenderer.invoke(UPLOAD_ADVERTISEMENT_CRAWL, data),
    
  });
}