import { supabase } from '../lib/supabase.js';

/**
 * App Config 서비스
 * Supabase의 app_config 테이블에서 설정 값을 가져옴
 */
export class AppConfigService {
  private static cache: Map<string, string> = new Map();

  /**
   * 단일 config 값 가져오기
   */
  static async get(key: string): Promise<string | null> {
    // 캐시 확인
    if (this.cache.has(key)) {
      return this.cache.get(key) || null;
    }

    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .single();

      if (error) {
        console.error(`[AppConfig] Failed to get config for key "${key}":`, error);
        return null;
      }

      const value = (data as any)?.value || null;

      // 캐시에 저장
      if (value) {
        this.cache.set(key, value);
      }

      return value;
    } catch (error) {
      console.error(`[AppConfig] Error getting config for key "${key}":`, error);
      return null;
    }
  }

  /**
   * 여러 config 값 한번에 가져오기
   */
  static async getMany(keys: string[]): Promise<Record<string, string>> {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', keys);

      if (error) {
        console.error('[AppConfig] Failed to get configs:', error);
        return {};
      }

      const result: Record<string, string> = {};

      if (data) {
        for (const item of data as any[]) {
          result[item.key] = item.value;
          // 캐시에도 저장
          this.cache.set(item.key, item.value);
        }
      }

      return result;
    } catch (error) {
      console.error('[AppConfig] Error getting configs:', error);
      return {};
    }
  }

  /**
   * Naver proxy 인증정보 가져오기
   */
  static async getNaverProxyCredentials(): Promise<{
    username: string | null;
    password: string | null;
  }> {
    const credentials = await this.getMany([
      'naver_proxy_username',
      'naver_proxy_password',
    ]);

    return {
      username: credentials.naver_proxy_username || null,
      password: credentials.naver_proxy_password || null,
    };
  }

  /**
   * 캐시 초기화
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Config 값 설정 (admin만 가능)
   */
  static async set(key: string, value: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert(
          {
            key,
            value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

      if (error) {
        console.error(`[AppConfig] Failed to set config for key "${key}":`, error);
        return false;
      }

      // 캐시 업데이트
      this.cache.set(key, value);
      return true;
    } catch (error) {
      console.error(`[AppConfig] Error setting config for key "${key}":`, error);
      return false;
    }
  }
}
