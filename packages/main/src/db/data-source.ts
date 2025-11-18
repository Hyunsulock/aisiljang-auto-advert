import { DataSource } from 'typeorm';
import { app } from 'electron';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { Offer } from './entities/Offer.entity.js';
import { Batch } from './entities/Batch.entity.js';
import { BatchItem } from './entities/BatchItem.entity.js';
import { CompetingAdsAnalysis } from './entities/CompetingAdsAnalysis.entity.js';

/**
 * 데이터베이스 경로 가져오기
 */
function getDbPath() {
  const DB_DIR = app.isPackaged
    ? join(app.getPath('userData'), 'data')
    : join(process.cwd(), 'data');

  // data 디렉토리 생성 (없으면)
  try {
    mkdirSync(DB_DIR, { recursive: true });
    console.log('✅ DB 디렉토리 생성/확인 완료:', DB_DIR);
  } catch (error) {
    console.log('⚠️  DB 디렉토리 생성 스킵 (이미 존재)');
  }

  return join(DB_DIR, 'app.db');
}

/**
 * TypeORM DataSource
 * synchronize: true로 설정하여 Entity 변경사항이 자동으로 DB에 반영되도록 함
 */
export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: getDbPath(),
  synchronize: true, // 개발 편의성을 위해 true, 프로덕션에서는 false 권장
  logging: false,
  entities: [Offer, Batch, BatchItem, CompetingAdsAnalysis],
  migrations: [],
  subscribers: [],
});

/**
 * DataSource 초기화
 */
export async function initializeDataSource() {
  try {
    if (!AppDataSource.isInitialized) {
      console.log('🔄 TypeORM DataSource 초기화 시작...');
      await AppDataSource.initialize();
      console.log('✅ TypeORM DataSource 초기화 완료!');
      console.log('📍 DB 경로:', getDbPath());
    }
    return { success: true };
  } catch (error) {
    console.error('❌ TypeORM DataSource 초기화 실패:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * DataSource 종료
 */
export async function closeDataSource() {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ TypeORM DataSource 종료 완료');
    }
  } catch (error) {
    console.error('❌ TypeORM DataSource 종료 실패:', error);
  }
}
