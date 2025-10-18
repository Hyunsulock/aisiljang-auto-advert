import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

// 데이터베이스 파일 경로
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

console.log('🔄 Running migrations...');
migrate(db, { migrationsFolder: './drizzle' });
console.log('✅ Migrations completed!');

sqlite.close();
