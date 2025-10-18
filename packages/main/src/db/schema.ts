import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * 매물 마스터 테이블
 * 이실장에서 크롤링한 매물 정보를 저장
 */
export const offers = sqliteTable('offers', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 매물 식별자
  numberN: text('number_n').notNull().unique(), // 네이버 매물번호 (고유키)
  numberA: text('number_a').notNull(), // 이실장 매물번호

  // 매물 기본 정보
  type: text('type').notNull(), // 매물 종류 (아파트, 오피스텔 등)
  name: text('name').notNull(), // 매물 이름 (예: "고덕그라시움")
  dong: text('dong'), // 동 정보 (예: "101")
  ho: text('ho'), // 호수 (예: "701")
  address: text('address').notNull(), // 전체 주소 (예: "고덕그라시움 101동 701호")

  // 면적 정보
  areaPublic: text('area_public'), // 공급면적 (㎡)
  areaPrivate: text('area_private'), // 전용면적 (㎡)
  areaPyeong: text('area_pyeong'), // 전용면적 (평)

  // 거래 정보
  dealType: text('deal_type').notNull(), // 매매/전세/월세
  price: text('price').notNull(), // 매매가 or 전세가 or 보증금 (만원 단위, 예: "175000")
  rent: text('rent'), // 월세 (월세인 경우만, 만원 단위, 예: "65")

  // 광고 정보
  adChannel: text('ad_channel'), // 노출 채널
  adMethod: text('ad_method'), // 검증 방식
  adStatus: text('ad_status').notNull(), // 광고 상태 (광고중, 거래완료 등)
  adStartDate: text('ad_start_date'), // 노출 시작일 (예: "25.10.15")
  adEndDate: text('ad_end_date'), // 노출 종료일 (예: "25.11.14")
  dateRange: text('date_range'), // 노출 기간 원본 (예: "25.10.15 ~ 25.11.14") - 호환성 유지

  // 네이버 순위 정보 (선택적)
  ranking: integer('ranking'), // 순위
  sharedRank: integer('shared_rank'), // 공유 순위
  isShared: integer('is_shared', { mode: 'boolean' }), // 순위 공유 여부
  sharedCount: integer('shared_count'), // 공유 개수
  total: integer('total'), // 전체 개수

  // 메타 정보
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * 배치 작업 테이블
 * 여러 매물을 묶어서 처리하는 배치 작업 그룹
 */
export const batches = sqliteTable('batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 배치 정보
  name: text('name').notNull(), // 배치 이름 (예: "2025-10-15 광고 재등록")

  // 배치 상태
  // pending: 대기중
  // scheduled: 예약됨
  // removing: 광고 내리는 중
  // removed: 광고 내리기 완료
  // uploading: 광고 올리는 중
  // completed: 완료
  // failed: 실패
  status: text('status').notNull().default('pending'),

  // 진행 상황
  totalCount: integer('total_count').notNull().default(0), // 전체 작업 개수
  completedCount: integer('completed_count').notNull().default(0), // 완료된 작업 개수
  failedCount: integer('failed_count').notNull().default(0), // 실패한 작업 개수

  // 스케줄 정보
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }), // 예약 실행 시간

  // 메타 정보
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  startedAt: integer('started_at', { mode: 'timestamp' }), // 작업 시작 시간
  completedAt: integer('completed_at', { mode: 'timestamp' }), // 작업 완료 시간
});

/**
 * 배치 아이템 테이블
 * 배치 작업 내 개별 매물의 작업 상태를 추적
 *
 * 사용자가 광고를 재등록할 때 가격을 수정할 수 있음
 */
export const batchItems = sqliteTable('batch_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 관계
  batchId: integer('batch_id').notNull().references(() => batches.id, { onDelete: 'cascade' }),
  offerId: integer('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),

  // 작업 상태
  // pending: 대기중
  // removing: 광고 내리는 중
  // removed: 광고 내리기 완료
  // uploading: 광고 올리는 중
  // completed: 완료
  // failed: 실패
  status: text('status').notNull().default('pending'),

  // 단계별 상태 (2단계 워크플로우)
  removeStatus: text('remove_status').default('pending'), // 광고 내리기 상태 (pending, processing, completed, failed)
  uploadStatus: text('upload_status').default('pending'), // 광고 올리기 상태 (pending, processing, completed, failed)

  // ===== 수정할 정보 (광고 재등록 시 적용) =====
  // null이면 원본 데이터 사용, 값이 있으면 수정된 값 사용
  modifiedPrice: text('modified_price'), // 수정할 가격 (매매가/전세가/보증금, 만원 단위)
  modifiedRent: text('modified_rent'), // 수정할 월세 (만원 단위)

  // 오류 정보
  errorMessage: text('error_message'), // 오류 메시지
  retryCount: integer('retry_count').notNull().default(0), // 재시도 횟수

  // 메타 정보
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  removeStartedAt: integer('remove_started_at', { mode: 'timestamp' }), // 광고 내리기 시작 시간
  removeCompletedAt: integer('remove_completed_at', { mode: 'timestamp' }), // 광고 내리기 완료 시간
  uploadStartedAt: integer('upload_started_at', { mode: 'timestamp' }), // 광고 올리기 시작 시간
  uploadCompletedAt: integer('upload_completed_at', { mode: 'timestamp' }), // 광고 올리기 완료 시간
});

// 타입 추론을 위한 타입 export
export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;

export type BatchItem = typeof batchItems.$inferSelect;
export type NewBatchItem = typeof batchItems.$inferInsert;
