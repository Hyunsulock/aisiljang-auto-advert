import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = app.isPackaged
  ? join(app.getPath('userData'), 'logs')
  : join(process.cwd(), 'logs');

try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch (error) {
  // 이미 존재하는 경우 무시
}

const LOG_FILE = join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);

export function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    appendFileSync(LOG_FILE, logMessage);
  } catch (error) {
    // 로그 실패는 무시
  }

  // 콘솔에도 출력
  console.log(message);
}

export function getLogFilePath() {
  return LOG_FILE;
}
