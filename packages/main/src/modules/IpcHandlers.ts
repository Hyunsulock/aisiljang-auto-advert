import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { BrowserWindow } from 'electron';
import { registerCrawlerHandlers } from '../ipc/CrawlerHandlers.js';
import { BatchScheduler } from '../services/batch/BatchScheduler.js';

/**
 * IPC 핸들러 등록 모듈
 */
class IpcHandlersModule implements AppModule {
  private batchScheduler: BatchScheduler | null = null;

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
    console.log('🚀 [IpcHandlers] 모듈 초기화 시작...');

    // 핸들러를 먼저 등록 (동기적으로)
    // DB, Auth, Batch, AdTest, PropertyOwner, Agency 핸들러는 각각의 모듈에서 등록됨
    console.log('📝 [IpcHandlers] Crawler 핸들러 등록...');
    registerCrawlerHandlers(); // 윈도우 없이 먼저 등록
    console.log('✅ [IpcHandlers] Crawler 핸들러 등록 완료!');

    // 마이그레이션은 백그라운드에서 실행 (app ready 이후)
    // app.whenReady().then(() => this.runMigrations());

    // 배치 스케줄러 시작
    this.batchScheduler = new BatchScheduler();
    this.batchScheduler.start();

    // 윈도우가 생성되면 크롤러 핸들러에 윈도우 참조 업데이트
    app.on('browser-window-created', (_, window) => {
      console.log('🪟 [IpcHandlers] 윈도우 생성됨, 크롤러 핸들러에 윈도우 참조 업데이트...');
      registerCrawlerHandlers(window); // 윈도우 참조 업데이트
    });

    // 이미 생성된 윈도우가 있다면 참조 업데이트
    const existingWindows = BrowserWindow.getAllWindows();
    if (existingWindows.length > 0) {
      console.log(`🪟 [IpcHandlers] 기존 윈도우 ${existingWindows.length}개 발견, 크롤러 핸들러에 윈도우 참조 업데이트...`);
      registerCrawlerHandlers(existingWindows[0]);
    }

    // 앱 종료 시 스케줄러 정리
    app.on('before-quit', () => {
      if (this.batchScheduler) {
        this.batchScheduler.stop();
      }
    });
  }


}

export function createIpcHandlersModule() {
  return new IpcHandlersModule();
}
