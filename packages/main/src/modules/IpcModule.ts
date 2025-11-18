import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { BrowserWindow } from 'electron';
import { registerCrawlerHandlers, setMainWindow } from '../features/crawler/index.js';

/**
 * IPC 핸들러 등록 모듈
 * 모든 features의 IPC 핸들러를 등록합니다
 */
export class IpcModule implements AppModule {
  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
    console.log('🚀 [IpcModule] IPC 핸들러 등록 시작...');

    // 핸들러 먼저 등록 (즉시 실행)
    registerCrawlerHandlers();

    // 윈도우가 생성되면 참조 업데이트
    app.on('browser-window-created', (_, window) => {
      setMainWindow(window);
    });

    // 이미 생성된 윈도우가 있다면 참조 업데이트
    const existingWindows = BrowserWindow.getAllWindows();
    if (existingWindows.length > 0) {
      setMainWindow(existingWindows[0]);
    }

    console.log('✅ [IpcModule] IPC 핸들러 등록 완료');
  }
}
