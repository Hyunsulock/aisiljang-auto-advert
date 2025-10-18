import { ipcMain } from 'electron';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { sql } from 'drizzle-orm';
import { offers } from '../db/schema.js';

/**
 * 데이터베이스 IPC 핸들러
 */
export function registerDbHandlers() {
  /**
   * 마이그레이션 실행
   */
  ipcMain.handle('db:migrate', async () => {
    try {
      console.log('🔄 데이터베이스 마이그레이션 시작...');

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
      console.log('✅ 데이터베이스 마이그레이션 완료!');

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ 마이그레이션 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * 모든 매물 삭제
   */
  ipcMain.handle('offers:delete-all', async () => {
    try {
      console.log('🗑️  모든 매물 삭제 시작...');

      const DB_DIR = join(process.cwd(), 'data');
      const DB_PATH = join(DB_DIR, 'app.db');

      const sqlite = new Database(DB_PATH);
      const db = drizzle(sqlite);

      // offers 테이블의 모든 데이터 삭제
      await db.delete(offers);

      sqlite.close();
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
}
