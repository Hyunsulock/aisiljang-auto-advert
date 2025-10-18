import { ipcMain } from 'electron';
import { CredentialsStore, type Credentials } from '../services/auth/CredentialsStore.js';

/**
 * 인증 정보 관리 IPC 핸들러
 */
export function registerAuthHandlers() {
  const credentialsStore = new CredentialsStore();

  /**
   * 계정 정보 저장
   */
  ipcMain.handle('auth:save-credentials', async (event, credentials: Credentials) => {
    try {
      await credentialsStore.save(credentials);
      return {
        success: true,
        message: '계정 정보가 안전하게 저장되었습니다',
      };
    } catch (error) {
      console.error('❌ 계정 정보 저장 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * 계정 정보 불러오기 (비밀번호는 마스킹)
   */
  ipcMain.handle('auth:get-credentials', async () => {
    try {
      const credentials = await credentialsStore.load();

      if (!credentials) {
        return {
          success: true,
          data: null,
        };
      }

      // 보안을 위해 비밀번호는 마스킹하여 반환
      return {
        success: true,
        data: {
          username: credentials.username,
          hasPassword: true,
        },
      };
    } catch (error) {
      console.error('❌ 계정 정보 불러오기 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * 계정 정보 삭제
   */
  ipcMain.handle('auth:delete-credentials', async () => {
    try {
      await credentialsStore.delete();
      return {
        success: true,
        message: '계정 정보가 삭제되었습니다',
      };
    } catch (error) {
      console.error('❌ 계정 정보 삭제 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * 계정 정보 존재 여부 확인
   */
  ipcMain.handle('auth:has-credentials', async () => {
    try {
      const exists = credentialsStore.exists();
      return {
        success: true,
        data: exists,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
