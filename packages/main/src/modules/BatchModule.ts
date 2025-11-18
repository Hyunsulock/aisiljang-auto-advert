import { ipcMain } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { BatchService, type CreateBatchRequest } from '../services/batch/BatchService.js';

/**
 * 배치 작업 모듈
 */
export class BatchModule implements AppModule {
  private batchService: BatchService | null = null;

  async enable(_context: ModuleContext): Promise<void> {
    console.log('[BatchModule] Initializing...');

    // enable 메서드 내에서 초기화
    this.batchService = new BatchService();

    /**
     * 배치 생성
     */
    ipcMain.handle('batch:create', async (_event, request: CreateBatchRequest) => {
      try {
        console.log('📦 배치 생성 요청 받음:', request);
        const batch = await this.batchService!.createBatch(request);
        console.log('✅ 배치 생성 성공:', batch);
        return {
          success: true,
          data: batch,
        };
      } catch (error) {
        console.error('❌ 배치 생성 실패:', error);
        console.error('스택 트레이스:', error instanceof Error ? error.stack : error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    /**
     * 모든 배치 조회
     */
    ipcMain.handle('batch:get-all', async () => {
      try {
        const batches = await this.batchService!.getAllBatches();
        return {
          success: true,
          data: batches,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    /**
     * 배치 상세 조회
     */
    ipcMain.handle('batch:get-detail', async (_event, batchId: number) => {
      try {
        const detail = await this.batchService!.getBatchDetail(batchId);
        return {
          success: true,
          data: detail,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    /**
     * 배치 삭제
     */
    ipcMain.handle('batch:delete', async (_event, batchId: number) => {
      try {
        await this.batchService!.deleteBatch(batchId);
        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    /**
     * 배치 실행
     */
    ipcMain.handle('batch:execute', async (event, batchId: number) => {
      try {
        console.log('🚀 배치 실행 IPC 요청 받음:', batchId);

        // 실시간 진행 상태 콜백
        const progressCallback = (update: any) => {
          event.sender.send('batch:progress', update);
        };

        const result = await this.batchService!.executeBatch(batchId, progressCallback);
        console.log('✅ 배치 실행 성공:', result);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('❌ 배치 실행 실패:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    /**
     * 배치 재시도 (실패한 항목만)
     */
    ipcMain.handle('batch:retry', async (event, batchId: number) => {
      try {
        console.log('🔄 배치 재시도 IPC 요청 받음:', batchId);

        // 실시간 진행 상태 콜백
        const progressCallback = (update: any) => {
          event.sender.send('batch:progress', update);
        };

        const result = await this.batchService!.retryBatch(batchId, progressCallback);
        console.log('✅ 배치 재시도 성공:', result);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('❌ 배치 재시도 실패:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    console.log('[BatchModule] Batch handlers registered');
  }
}
