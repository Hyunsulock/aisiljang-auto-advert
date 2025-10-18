import { db, batches, batchItems, type Batch, type NewBatch, type BatchItem, type NewBatchItem } from '../db/index.js';
import { eq, desc, and } from 'drizzle-orm';

/**
 * 배치 작업 데이터베이스 Repository
 */
export class BatchRepository {
  /**
   * 배치 생성
   */
  async create(batchData: NewBatch): Promise<Batch> {
    const result = await db.insert(batches).values(batchData).returning();
    return result[0];
  }

  /**
   * 배치 아이템 일괄 생성
   */
  async createItems(items: NewBatchItem[]): Promise<BatchItem[]> {
    const result = await db.insert(batchItems).values(items).returning();
    return result;
  }

  /**
   * 배치 조회
   */
  async findById(id: number): Promise<Batch | undefined> {
    return await db.query.batches.findFirst({
      where: eq(batches.id, id),
    });
  }

  /**
   * 배치의 아이템들 조회
   */
  async findItemsByBatchId(batchId: number): Promise<BatchItem[]> {
    return await db.query.batchItems.findMany({
      where: eq(batchItems.batchId, batchId),
    });
  }

  /**
   * 모든 배치 조회 (최신순)
   */
  async findAll(): Promise<Batch[]> {
    return await db.query.batches.findMany({
      orderBy: [desc(batches.createdAt)],
    });
  }

  /**
   * 배치 상태 업데이트
   */
  async updateStatus(id: number, status: string): Promise<void> {
    await db.update(batches).set({ status }).where(eq(batches.id, id));
  }

  /**
   * 배치 진행 상황 업데이트
   */
  async updateProgress(id: number, completedCount: number, failedCount: number): Promise<void> {
    await db.update(batches).set({ completedCount, failedCount }).where(eq(batches.id, id));
  }

  /**
   * 배치 시작 시간 기록
   */
  async markStarted(id: number): Promise<void> {
    await db.update(batches).set({ startedAt: new Date() }).where(eq(batches.id, id));
  }

  /**
   * 배치 완료 시간 기록
   */
  async markCompleted(id: number): Promise<void> {
    await db.update(batches).set({ completedAt: new Date() }).where(eq(batches.id, id));
  }

  /**
   * 배치 아이템 상태 업데이트
   */
  async updateItemStatus(itemId: number, status: string, errorMessage?: string): Promise<void> {
    await db.update(batchItems).set({
      status,
      errorMessage: errorMessage ?? null,
    }).where(eq(batchItems.id, itemId));
  }

  /**
   * 배치 아이템의 remove 상태 업데이트
   */
  async updateItemRemoveStatus(itemId: number, removeStatus: string): Promise<void> {
    const updates: any = { removeStatus };

    if (removeStatus === 'processing') {
      updates.removeStartedAt = new Date();
    } else if (removeStatus === 'completed') {
      updates.removeCompletedAt = new Date();
      updates.status = 'removed';
    }

    await db.update(batchItems).set(updates).where(eq(batchItems.id, itemId));
  }

  /**
   * 배치 아이템의 upload 상태 업데이트
   */
  async updateItemUploadStatus(itemId: number, uploadStatus: string): Promise<void> {
    const updates: any = { uploadStatus };

    if (uploadStatus === 'processing') {
      updates.uploadStartedAt = new Date();
    } else if (uploadStatus === 'completed') {
      updates.uploadCompletedAt = new Date();
      updates.status = 'completed';
    }

    await db.update(batchItems).set(updates).where(eq(batchItems.id, itemId));
  }

  /**
   * 배치 삭제
   */
  async delete(id: number): Promise<void> {
    await db.delete(batches).where(eq(batches.id, id));
  }

  /**
   * 실패한 배치 아이템 조회
   */
  async findFailedItemsByBatchId(batchId: number): Promise<BatchItem[]> {
    return await db.query.batchItems.findMany({
      where: and(
        eq(batchItems.batchId, batchId),
        eq(batchItems.status, 'failed')
      ),
    });
  }

  /**
   * 배치 아이템 상태 초기화 (재시도용)
   */
  async resetItemStatus(itemId: number): Promise<void> {
    await db.update(batchItems).set({
      status: 'pending',
      uploadStatus: 'pending',
      errorMessage: null,
      uploadStartedAt: null,
      uploadCompletedAt: null,
    }).where(eq(batchItems.id, itemId));
  }
}
