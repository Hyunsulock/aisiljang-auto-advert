import { safeStorage } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

export interface Credentials {
  username: string;
  password: string;
}

/**
 * 이실장 인증 정보 안전 저장소
 * Electron의 safeStorage를 사용하여 암호화된 방식으로 저장
 */
export class CredentialsStore {
  private credentialsPath: string;

  constructor() {
    const dataDir = join(process.cwd(), 'data');

    // data 디렉토리 생성 (없으면)
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.credentialsPath = join(dataDir, 'credentials.enc');
  }

  /**
   * 인증 정보 저장 (암호화)
   */
  async save(credentials: Credentials): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('암호화를 사용할 수 없습니다. 시스템 키체인에 접근할 수 없습니다.');
    }

    const json = JSON.stringify(credentials);
    const buffer = Buffer.from(json, 'utf-8');
    const encrypted = safeStorage.encryptString(json);

    writeFileSync(this.credentialsPath, encrypted);
    console.log('✅ 인증 정보가 안전하게 저장되었습니다');
  }

  /**
   * 인증 정보 불러오기 (복호화)
   */
  async load(): Promise<Credentials | null> {
    if (!existsSync(this.credentialsPath)) {
      console.log('ℹ️  저장된 인증 정보가 없습니다');
      return null;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('암호화를 사용할 수 없습니다. 시스템 키체인에 접근할 수 없습니다.');
    }

    try {
      const encrypted = readFileSync(this.credentialsPath);
      const decrypted = safeStorage.decryptString(encrypted);
      const credentials = JSON.parse(decrypted) as Credentials;

      console.log('✅ 인증 정보를 불러왔습니다');
      return credentials;
    } catch (error) {
      console.error('❌ 인증 정보 복호화 실패:', error);
      return null;
    }
  }

  /**
   * 인증 정보 삭제
   */
  async delete(): Promise<void> {
    if (existsSync(this.credentialsPath)) {
      const fs = await import('fs/promises');
      await fs.unlink(this.credentialsPath);
      console.log('✅ 인증 정보가 삭제되었습니다');
    }
  }

  /**
   * 저장된 인증 정보 존재 여부 확인
   */
  exists(): boolean {
    return existsSync(this.credentialsPath);
  }
}
