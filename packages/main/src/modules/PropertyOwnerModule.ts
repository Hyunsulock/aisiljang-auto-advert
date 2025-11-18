import { dialog, ipcMain } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { PropertyOwnerRepository } from '../repositories/PropertyOwnerRepository.js';
import { FileStorageService } from '../services/FileStorageService.js';
import type { PropertyVerificationInfoInsert } from '../types/supabase.js';
import { setSessionFromRenderer, getCurrentUserAgencyId } from '../lib/supabase.js';
import path from 'path';

/**
 * 매물 소유자 정보 관리 모듈
 */
export class PropertyOwnerModule implements AppModule {
  private propertyOwnerRepo: PropertyOwnerRepository;
  private fileStorageService: FileStorageService;

  constructor() {
    this.propertyOwnerRepo = new PropertyOwnerRepository();
    this.fileStorageService = new FileStorageService();
  }

  async enable(_context: ModuleContext): Promise<void> {
    console.log('[PropertyOwnerModule] Initializing...');

    /**
     * Renderer의 세션을 Main 프로세스에 설정
     */
    ipcMain.handle('propertyOwner:setSession', async (_, accessToken: string, refreshToken: string) => {
      try {
        await setSessionFromRenderer(accessToken, refreshToken);
        console.log('[PropertyOwnerModule] Session set from renderer');
        return { success: true };
      } catch (error: any) {
        console.error('Failed to set session:', error);
        return { success: false, error: error.message };
      }
    });

    /**
     * 소유자 정보 조회
     */
    ipcMain.handle('propertyOwner:get', async (_, propertyName: string, dong: string, ho: string) => {
      try {
        const properties = await this.propertyOwnerRepo.getPropertiesByKeys([
          { name: propertyName, dong: dong || '', ho: ho || '' },
        ]);

        return {
          success: true,
          data: properties[0] || null,
        };
      } catch (error: any) {
        console.error('Failed to get property owner:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    /**
     * 소유자 정보 저장 (파일 업로드 포함)
     */
    ipcMain.handle(
      'propertyOwner:save',
      async (
        _,
        propertyName: string,
        dong: string,
        ho: string,
        verificationInfo: Omit<PropertyVerificationInfoInsert, 'property_id'>,
        documentFilePath?: string,
        registerFilePath?: string,
        powerOfAttorneyFilePath?: string
      ) => {
        try {
          console.log('[PropertyOwnerModule] Saving property owner:', {
            propertyName,
            dong,
            ho,
            verificationInfo,
            documentFilePath,
            registerFilePath,
            powerOfAttorneyFilePath,
          });

          // 현재 사용자의 agency_id 가져오기
          const agencyId = await getCurrentUserAgencyId();
          if (!agencyId) {
            throw new Error('사용자의 agency 정보를 찾을 수 없습니다. 관리자에게 문의하세요.');
          }

          // 파일 업로드
          let documentStoragePath: string | undefined;
          let registerStoragePath: string | undefined;
          let powerOfAttorneyStoragePath: string | undefined;

          // 한글 경로 문제 해결: 간단한 해시 사용
          // Supabase Storage는 한글을 지원하지 않으므로 property key를 해시로 변환
          const propertyKey = `${propertyName}_${dong || ''}_${ho || ''}`;
          const hashCode = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
              const char = str.charCodeAt(i);
              hash = ((hash << 5) - hash) + char;
              hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(36);
          };
          const propertyPath = hashCode(propertyKey);

          console.log('[PropertyOwnerModule] Property path:', {
            original: propertyKey,
            hashed: propertyPath,
            agencyId,
          });

          if (documentFilePath) {
            const ext = path.extname(documentFilePath);
            const fileName = `document_${Date.now()}${ext}`;
            const fullPath = `${agencyId}/documents/${propertyPath}/${fileName}`;
            console.log('[PropertyOwnerModule] Uploading document to:', fullPath);
            const uploadResult = await this.fileStorageService.uploadFile(
              documentFilePath,
              fullPath
            );
            documentStoragePath = uploadResult.path;
            console.log('[PropertyOwnerModule] Document uploaded:', documentStoragePath);
          }

          if (registerFilePath) {
            const ext = path.extname(registerFilePath);
            const fileName = `register_${Date.now()}${ext}`;
            const fullPath = `${agencyId}/registers/${propertyPath}/${fileName}`;
            console.log('[PropertyOwnerModule] Uploading register to:', fullPath);
            const uploadResult = await this.fileStorageService.uploadFile(
              registerFilePath,
              fullPath
            );
            registerStoragePath = uploadResult.path;
            console.log('[PropertyOwnerModule] Register uploaded:', registerStoragePath);
          }

          if (powerOfAttorneyFilePath) {
            const ext = path.extname(powerOfAttorneyFilePath);
            const fileName = `power_of_attorney_${Date.now()}${ext}`;
            const fullPath = `${agencyId}/power_of_attorney/${propertyPath}/${fileName}`;
            console.log('[PropertyOwnerModule] Uploading power of attorney to:', fullPath);
            const uploadResult = await this.fileStorageService.uploadFile(
              powerOfAttorneyFilePath,
              fullPath
            );
            powerOfAttorneyStoragePath = uploadResult.path;
            console.log('[PropertyOwnerModule] Power of attorney uploaded:', powerOfAttorneyStoragePath);
          }

          const dataToSave = {
            ...verificationInfo,
            agency_id: agencyId,
            document_file_path: documentStoragePath || verificationInfo.document_file_path || '',
            register_file_path: registerStoragePath || verificationInfo.register_file_path || null,
            power_of_attorney_file_path: powerOfAttorneyStoragePath || verificationInfo.power_of_attorney_file_path || null,
          };

          console.log('[PropertyOwnerModule] Data to save:', dataToSave);

          // Supabase에 저장
          const propertyWithVerification = await this.propertyOwnerRepo.savePropertyWithVerification(
            { name: propertyName, dong: dong || '', ho: ho || '' },
            dataToSave
          );

          console.log('[PropertyOwnerModule] Saved successfully:', propertyWithVerification);

          return {
            success: true,
            data: propertyWithVerification,
          };
        } catch (error: any) {
          console.error('Failed to save property owner:', error);
          return {
            success: false,
            error: error.message,
          };
        }
      }
    );

    /**
     * 소유자 정보 삭제
     */
    ipcMain.handle('propertyOwner:delete', async (_, propertyName: string, dong: string, ho: string) => {
      try {
        // 먼저 파일 정보 가져오기
        const properties = await this.propertyOwnerRepo.getPropertiesByKeys([
          { name: propertyName, dong: dong || '', ho: ho || '' },
        ]);

        const property = properties[0];

        if (property) {
          // Supabase Storage에서 파일 삭제
          if (property.document_file_path) {
            await this.fileStorageService.deleteFile(property.document_file_path);
          }
          if (property.register_file_path) {
            await this.fileStorageService.deleteFile(property.register_file_path);
          }
          if (property.power_of_attorney_file_path) {
            await this.fileStorageService.deleteFile(property.power_of_attorney_file_path);
          }

          // DB에서 삭제
          await this.propertyOwnerRepo.deleteVerificationInfo(property.id);
        }

        return {
          success: true,
        };
      } catch (error: any) {
        console.error('Failed to delete property owner:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    /**
     * 파일 선택 다이얼로그 열기
     */
    ipcMain.handle('propertyOwner:selectFile', async () => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [
            { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return {
            success: false,
            canceled: true,
          };
        }

        return {
          success: true,
          filePath: result.filePaths[0],
        };
      } catch (error: any) {
        console.error('Failed to select file:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    /**
     * 파일 다운로드 (로컬에 저장)
     */
    ipcMain.handle('propertyOwner:downloadFile', async (_, storageFilePath: string, saveAsName: string) => {
      try {
        const result = await dialog.showSaveDialog({
          defaultPath: saveAsName,
          filters: [
            { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.canceled || !result.filePath) {
          return {
            success: false,
            canceled: true,
          };
        }

        await this.fileStorageService.downloadFile(storageFilePath, result.filePath);

        return {
          success: true,
          filePath: result.filePath,
        };
      } catch (error: any) {
        console.error('Failed to download file:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    /**
     * 개별 파일 삭제
     */
    ipcMain.handle(
      'propertyOwner:deleteFile',
      async (_, propertyName: string, dong: string, ho: string, fileType: 'document' | 'register' | 'powerOfAttorney') => {
        try {
          // 먼저 현재 property 정보 가져오기
          const properties = await this.propertyOwnerRepo.getPropertiesByKeys([
            { name: propertyName, dong: dong || '', ho: ho || '' },
          ]);

          const property = properties[0];
          if (!property || !property.verification_id) {
            return {
              success: false,
              error: '소유자 정보를 찾을 수 없습니다',
            };
          }

          // 파일 경로 확인 및 스토리지에서 삭제
          let filePathToDelete: string | null = null;
          const updateData: Partial<PropertyVerificationInfoInsert> = {};

          switch (fileType) {
            case 'document':
              filePathToDelete = property.document_file_path;
              updateData.document_file_path = ''; // 필수 필드이므로 빈 문자열
              break;
            case 'register':
              filePathToDelete = property.register_file_path;
              updateData.register_file_path = null;
              updateData.register_unique_no = null; // 등기부등본 삭제 시 고유번호도 삭제
              break;
            case 'powerOfAttorney':
              filePathToDelete = property.power_of_attorney_file_path;
              updateData.power_of_attorney_file_path = null;
              break;
          }

          // 스토리지에서 파일 삭제
          if (filePathToDelete) {
            await this.fileStorageService.deleteFile(filePathToDelete);
          }

          // 현재 사용자의 agency_id 가져오기
          const agencyId = await getCurrentUserAgencyId();
          if (!agencyId) {
            throw new Error('사용자의 agency 정보를 찾을 수 없습니다. 관리자에게 문의하세요.');
          }

          // DB 업데이트
          await this.propertyOwnerRepo.savePropertyWithVerification(
            { name: propertyName, dong: dong || '', ho: ho || '' },
            {
              agency_id: agencyId,
              owner_type: property.owner_type as '개인' | '법인' | '외국인' | '위임장',
              document_file_path: (updateData.document_file_path ?? property.document_file_path) || '',
              register_file_path: updateData.register_file_path !== undefined ? updateData.register_file_path : property.register_file_path,
              power_of_attorney_file_path: updateData.power_of_attorney_file_path !== undefined ? updateData.power_of_attorney_file_path : property.power_of_attorney_file_path,
              register_unique_no: updateData.register_unique_no !== undefined ? updateData.register_unique_no : property.register_unique_no,
            }
          );

          return {
            success: true,
          };
        } catch (error: any) {
          console.error('Failed to delete file:', error);
          return {
            success: false,
            error: error.message,
          };
        }
      }
    );

    console.log('[PropertyOwnerModule] PropertyOwner handlers registered');
  }
}
