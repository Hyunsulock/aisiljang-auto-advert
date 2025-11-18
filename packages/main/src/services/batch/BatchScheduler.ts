import { BatchRepository } from '../../repositories/BatchRepository.js';
import { BatchService } from './BatchService.js';
import { AppDataSource } from '../../db/data-source.js';

/**
 * 배치 스케줄러
 * 예약된 배치를 자동으로 실행하는 백그라운드 작업
 */
export class BatchScheduler {
  private batchRepo: BatchRepository;
  private batchService: BatchService;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.batchRepo = new BatchRepository();
    this.batchService = new BatchService();
  }

  /**
   * 스케줄러 시작
   * 1분마다 예약된 배치를 확인하여 실행
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  스케줄러가 이미 실행 중입니다');
      return;
    }

    console.log('⏰ 배치 스케줄러 시작');
    this.isRunning = true;

    // 즉시 한 번 실행
    this.checkScheduledBatches();

    // 1분마다 확인
    this.checkInterval = setInterval(() => {
      this.checkScheduledBatches();
    }, 60 * 1000); // 1분
  }

  /**
   * 스케줄러 중지
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('⏰ 배치 스케줄러 중지');
  }

  /**
   * 예약된 배치 확인 및 실행
   */
  private async checkScheduledBatches() {
    try {
      // DataSource가 초기화되지 않았으면 스킵
      if (!AppDataSource.isInitialized) {
        console.log('⚠️  DataSource가 아직 초기화되지 않았습니다. 스케줄 확인 스킵');
        return;
      }

      const allBatches = await this.batchRepo.findAll();
      const now = new Date();

      for (const batch of allBatches) {
        // 'scheduled' 상태이고 scheduledAt 시간이 지난 배치 찾기
        if (
          batch.status === 'scheduled' &&
          batch.scheduledAt &&
          new Date(batch.scheduledAt) <= now
        ) {
          console.log(`🚀 예약된 배치 자동 실행: ${batch.name} (ID: ${batch.id})`);
          console.log(`   예약 시간: ${new Date(batch.scheduledAt).toLocaleString('ko-KR')}`);
          console.log(`   현재 시간: ${now.toLocaleString('ko-KR')}`);

          // 백그라운드에서 비동기로 실행 (에러가 발생해도 스케줄러는 계속 동작)
          this.executeBatchAsync(batch.id);
        }
      }
    } catch (error) {
      console.error('❌ 스케줄 확인 중 오류:', error);
    }
  }

  /**
   * 배치를 비동기로 실행 (에러 처리 포함)
   */
  private async executeBatchAsync(batchId: number) {
    try {
      await this.batchService.executeBatch(batchId);
    } catch (error) {
      console.error(`❌ 배치 자동 실행 실패 (ID: ${batchId}):`, error);
    }
  }
}
