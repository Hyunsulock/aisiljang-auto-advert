import { ipcMain } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { CredentialsStore, type Credentials } from '../services/auth/CredentialsStore.js';

/**
 * 인증 정보 관리 모듈
 */
export class AuthModule implements AppModule {
  private credentialsStore: CredentialsStore | null = null;

  async enable(_context: ModuleContext): Promise<void> {
    console.log('[AuthModule] Initializing...');

    // enable 메서드 내에서 초기화
    this.credentialsStore = new CredentialsStore();

    /**
     * 계정 정보 저장
     */
    ipcMain.handle('auth:save-credentials', async (_event, credentials: Credentials) => {
      try {
        await this.credentialsStore!.save(credentials);
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
        const credentials = await this.credentialsStore!.load();

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
        await this.credentialsStore!.delete();
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
        const exists = this.credentialsStore!.exists();
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

    console.log('[AuthModule] Auth handlers registered');
  }
}
