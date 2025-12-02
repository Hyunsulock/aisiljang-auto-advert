import { supabase, STORAGE_BUCKET, getReferenceFilePath } from '../lib/supabase.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 파일 저장 서비스 (Supabase Storage)
 */
export class FileStorageService {
  /**
   * 파일 업로드
   */
  async uploadFile(
    localFilePath: string,
    storageFilePath: string,
    contentType?: string
  ): Promise<{ path: string; url: string }> {
    // 파일 읽기
    const fileBuffer = fs.readFileSync(localFilePath);

    // Content-Type 자동 감지
    const detectedContentType = contentType || this.getContentType(localFilePath);

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storageFilePath, fileBuffer, {
        contentType: detectedContentType,
        upsert: true, // 이미 존재하면 덮어쓰기
      });

    if (error) {
      console.error('❌ 파일 업로드 실패:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // 공개 URL 생성 (private bucket이므로 signed URL 필요)
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return {
      path: data.path,
      url: urlData.publicUrl,
    };
  }

  /**
   * 서류 첨부 파일 업로드 (분양계약서, 사업자등록증 등)
   */
  async uploadReferenceFile(
    localFilePath: string,
    agencyId: string,
    propertyName: string,
    dong: string,
    ho: string,
    documentType: string // 예: '분양계약서', '사업자등록증'
  ): Promise<{ path: string; url: string }> {
    const ext = path.extname(localFilePath);
    const filename = `${documentType}_${Date.now()}${ext}`;
    const storageFilePath = getReferenceFilePath(agencyId, propertyName, dong, ho, filename);
    return this.uploadFile(localFilePath, storageFilePath);
  }

  /**
   * 파일 다운로드
   */
  async downloadFile(storageFilePath: string, localFilePath: string): Promise<void> {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storageFilePath);

    if (error) {
      console.error('❌ 파일 다운로드 실패:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }

    // Blob을 Buffer로 변환하여 파일로 저장
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 디렉토리 생성
    const dir = path.dirname(localFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 파일 저장
    fs.writeFileSync(localFilePath, buffer);
    console.log(`✅ 파일 다운로드 완료: ${localFilePath}`);
  }

  /**
   * 파일 삭제
   */
  async deleteFile(storageFilePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storageFilePath]);

    if (error) {
      console.error('❌ 파일 삭제 실패:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }

    console.log(`✅ 파일 삭제 완료: ${storageFilePath}`);
  }

  /**
   * 여러 파일 삭제
   */
  async deleteFiles(storageFilePaths: string[]): Promise<void> {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(storageFilePaths);

    if (error) {
      console.error('❌ 파일 삭제 실패:', error);
      throw new Error(`Failed to delete files: ${error.message}`);
    }

    console.log(`✅ ${storageFilePaths.length}개 파일 삭제 완료`);
  }

  /**
   * Signed URL 생성 (private 파일 접근용)
   */
  async getSignedUrl(storageFilePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storageFilePath, expiresIn);

    if (error) {
      console.error('❌ Signed URL 생성 실패:', error);
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Content-Type 감지
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
}