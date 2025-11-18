import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { BatchScheduler } from '../services/batch/BatchScheduler.js';

/**
 * 스케줄러 모듈
 *
 * - BatchScheduler: 예약된 배치 자동 실행
 */
export class SchedulerModule implements AppModule {
  private batchScheduler: BatchScheduler | null = null;

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
    console.log('🚀 [SchedulerModule] 모듈 초기화 시작...');

    // 배치 스케줄러 시작
    this.batchScheduler = new BatchScheduler();
    this.batchScheduler.start();

    // 앱 종료 시 스케줄러 정리
    app.on('before-quit', () => {
      if (this.batchScheduler) {
        this.batchScheduler.stop();
      }
    });

    console.log('✅ [SchedulerModule] 모듈 초기화 완료');
  }
}
