import { ipcMain } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { initializeDataSource, closeDataSource } from '../db/data-source.js';
import { OfferRepository } from '../repositories/OfferRepository.js';

/**
 * 데이터베이스 모듈
 * TypeORM DataSource 초기화 및 기본 DB 작업을 위한 IPC 핸들러 등록
 */
export class DbModule implements AppModule {
  private offerRepo: OfferRepository | null = null;

  /**
   * DataSource 초기화
   */
  private async initialize() {
    const result = await initializeDataSource();
    if (!result.success) {
      console.error(`⚠️ TypeORM DataSource 초기화 실패했지만 핸들러는 등록합니다: ${result.error}`);
      // throw 하지 않고 계속 진행
    } else {
      console.log('✅ TypeORM DataSource 초기화 성공!');
    }
    return result;
  }

  async enable(_context: ModuleContext): Promise<void> {
    console.log('[DbModule] Initializing...');

    // TypeORM DataSource 초기화
    await this.initialize();

    // Repository 초기화
    this.offerRepo = new OfferRepository();

    /**
     * 수동 초기화 핸들러 (이전 마이그레이션 핸들러 대체)
     */
    ipcMain.handle('db:migrate', async () => {
      return await this.initialize();
    });

    /**
     * 모든 매물 삭제
     */
    ipcMain.handle('offers:delete-all', async () => {
      try {
        console.log('🗑️  모든 매물 삭제 시작...');

        await this.offerRepo!.deleteAll();

        console.log('✅ 모든 매물 삭제 완료!');

        return {
          success: true,
        };
      } catch (error) {
        console.error('❌ 매물 삭제 실패:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    /**
     * DB에서 모든 매물 조회 (경쟁 광고 분석 포함)
     */
    ipcMain.handle('offers:get-all', async () => {
      try {
        const offers = await this.offerRepo!.findAllWithAnalysis();
        return {
          success: true,
          data: offers,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    console.log('[DbModule] DB handlers registered');
  }

  /**
   * 모듈 비활성화 시 DataSource 종료
   */
  async disable(): Promise<void> {
    await closeDataSource();
    console.log('[DbModule] Disabled');
  }
}
