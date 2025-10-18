import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { BrowserWindow } from 'electron';
import { registerCrawlerHandlers } from '../ipc/CrawlerHandlers.js';
import { registerDbHandlers } from '../ipc/DbHandlers.js';
import { registerBatchHandlers } from '../ipc/BatchHandlers.js';
import { registerAuthHandlers } from '../ipc/AuthHandlers.js';
import { BatchScheduler } from '../services/batch/BatchScheduler.js';

/**
 * IPC 핸들러 등록 모듈
 */
class IpcHandlersModule implements AppModule {
  private batchScheduler: BatchScheduler | null = null;

  async enable({ app }: ModuleContext): Promise<void> {
    // 앱 시작 시 자동으로 마이그레이션 실행
    await this.runMigrations();

    // DB 핸들러 등록 (윈도우 무관)
    registerDbHandlers();
    registerBatchHandlers();
    registerAuthHandlers();

    // 배치 스케줄러 시작
    this.batchScheduler = new BatchScheduler();
    this.batchScheduler.start();

    app.on('browser-window-created', (_, window) => {
      this.registerHandlers(window);
    });

    // 이미 생성된 윈도우가 있다면 등록
    const existingWindows = BrowserWindow.getAllWindows();
    existingWindows.forEach((window) => {
      this.registerHandlers(window);
    });

    // 앱 종료 시 스케줄러 정리
    app.on('before-quit', () => {
      if (this.batchScheduler) {
        this.batchScheduler.stop();
      }
    });
  }

  private async runMigrations() {
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    const Database = (await import('better-sqlite3')).default;
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const { join } = await import('path');
    const { mkdirSync } = await import('fs');

    try {
      console.log('🔄 데이터베이스 마이그레이션 확인 중...');

      const DB_DIR = join(process.cwd(), 'data');
      const DB_PATH = join(DB_DIR, 'app.db');

      // data 디렉토리 생성 (없으면)
      try {
        mkdirSync(DB_DIR, { recursive: true });
      } catch (error) {
        // 이미 존재하는 경우 무시
      }

      const sqlite = new Database(DB_PATH);
      const db = drizzle(sqlite);

      migrate(db, { migrationsFolder: join(process.cwd(), 'packages/main/drizzle') });

      sqlite.close();
      console.log('✅ 데이터베이스 준비 완료!');
    } catch (error) {
      console.error('❌ 마이그레이션 실패:', error);
      throw error;
    }
  }

  private registerHandlers(window: BrowserWindow) {
    // 크롤러 관련 IPC 핸들러 등록
    registerCrawlerHandlers(window);
  }
}

export function createIpcHandlersModule() {
  return new IpcHandlersModule();
}
