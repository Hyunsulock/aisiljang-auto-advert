import { ipcMain } from 'electron';
import { BatchService, type CreateBatchRequest } from '../services/batch/BatchService.js';

/**
 * 배치 작업 IPC 핸들러
 */
export function registerBatchHandlers() {
  const batchService = new BatchService();

  /**
   * 배치 생성
   */
  ipcMain.handle('batch:create', async (event, request: CreateBatchRequest) => {
    try {
      console.log('📦 배치 생성 요청 받음:', request);
      const batch = await batchService.createBatch(request);
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
      const batches = await batchService.getAllBatches();
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
  ipcMain.handle('batch:get-detail', async (event, batchId: number) => {
    try {
      const detail = await batchService.getBatchDetail(batchId);
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
  ipcMain.handle('batch:delete', async (event, batchId: number) => {
    try {
      await batchService.deleteBatch(batchId);
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
      const result = await batchService.executeBatch(batchId);
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
      const result = await batchService.retryBatch(batchId);
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
}
