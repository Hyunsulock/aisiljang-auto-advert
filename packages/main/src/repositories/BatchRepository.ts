import { Repository } from 'typeorm';
import { AppDataSource } from '../db/data-source.js';
import { Batch } from '../db/entities/Batch.entity.js';
import { BatchItem } from '../db/entities/BatchItem.entity.js';

/**
 * 배치 작업 데이터베이스 Repository
 */
export class BatchRepository {
  private batchRepo: Repository<Batch>;
  private itemRepo: Repository<BatchItem>;

  constructor() {
    this.batchRepo = AppDataSource.getRepository(Batch);
    this.itemRepo = AppDataSource.getRepository(BatchItem);
  }

  /**
   * 배치 생성
   */
  async create(batchData: Partial<Batch>): Promise<Batch> {
    const batch = this.batchRepo.create(batchData);
    return await this.batchRepo.save(batch);
  }

  /**
   * 배치 아이템 일괄 생성
   */
  async createItems(items: Partial<BatchItem>[]): Promise<BatchItem[]> {
    const batchItems = this.itemRepo.create(items);
    return await this.itemRepo.save(batchItems);
  }

  /**
   * 배치 조회
   */
  async findById(id: number): Promise<Batch | null> {
    return await this.batchRepo.findOne({
      where: { id },
    });
  }

  /**
   * 배치의 아이템들 조회
   */
  async findItemsByBatchId(batchId: number): Promise<BatchItem[]> {
    return await this.itemRepo.find({
      where: { batchId },
    });
  }

  /**
   * 모든 배치 조회 (최신순)
   */
  async findAll(): Promise<Batch[]> {
    return await this.batchRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 배치 상태 업데이트
   */
  async updateStatus(id: number, status: string): Promise<void> {
    await this.batchRepo.update({ id }, { status });
  }

  /**
   * 배치 진행 상황 업데이트
   */
  async updateProgress(id: number, completedCount: number, failedCount: number): Promise<void> {
    await this.batchRepo.update({ id }, { completedCount, failedCount });
  }

  /**
   * 배치 시작 시간 기록
   */
  async markStarted(id: number): Promise<void> {
    await this.batchRepo.update({ id }, { startedAt: new Date() });
  }

  /**
   * 배치 완료 시간 기록
   */
  async markCompleted(id: number): Promise<void> {
    await this.batchRepo.update({ id }, { completedAt: new Date() });
  }

  /**
   * 배치 아이템 상태 업데이트
   */
  async updateItemStatus(itemId: number, status: string, errorMessage?: string): Promise<void> {
    await this.itemRepo.update(
      { id: itemId },
      {
        status,
        errorMessage: errorMessage ?? null,
      }
    );
  }

  /**
   * 배치 아이템의 가격 수정 상태 업데이트
   */
  async updateItemModifyStatus(itemId: number, modifyStatus: string): Promise<void> {
    const updates: Partial<BatchItem> = { modifyStatus };

    if (modifyStatus === 'processing') {
      updates.modifyStartedAt = new Date();
    } else if (modifyStatus === 'completed') {
      updates.modifyCompletedAt = new Date();
      updates.status = 'modified';
    }

    await this.itemRepo.update({ id: itemId }, updates);
  }

  /**
   * 배치 아이템의 재광고 상태 업데이트
   */
  async updateItemReAdvertiseStatus(itemId: number, reAdvertiseStatus: string): Promise<void> {
    const updates: Partial<BatchItem> = { reAdvertiseStatus };

    if (reAdvertiseStatus === 'processing') {
      updates.reAdvertiseStartedAt = new Date();
    } else if (reAdvertiseStatus === 'completed') {
      updates.reAdvertiseCompletedAt = new Date();
      updates.status = 'completed';
    }

    await this.itemRepo.update({ id: itemId }, updates);
  }

  /**
   * 배치 삭제
   */
  async delete(id: number): Promise<void> {
    await this.batchRepo.delete({ id });
  }

  /**
   * 실패한 배치 아이템 조회
   */
  async findFailedItemsByBatchId(batchId: number): Promise<BatchItem[]> {
    return await this.itemRepo.find({
      where: {
        batchId,
        status: 'failed',
      },
    });
  }

  /**
   * 배치 아이템 상태 초기화 (재시도용)
   */
  async resetItemStatus(itemId: number): Promise<void> {
    await this.itemRepo.update(
      { id: itemId },
      {
        status: 'pending',
        reAdvertiseStatus: 'pending',
        errorMessage: null,
        currentStep: null,
        reAdvertiseStartedAt: null,
        reAdvertiseCompletedAt: null,
      }
    );
  }

  /**
   * 배치 아이템의 현재 단계 업데이트
   */
  async updateItemStep(itemId: number, step: string): Promise<void> {
    await this.itemRepo.update({ id: itemId }, { currentStep: step });
  }
}
