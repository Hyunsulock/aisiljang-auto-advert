import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase.js';

// Supabase 설정 - ANON KEY는 공개 키이므로 하드코딩 가능
const supabaseUrl = 'https://wpwahxqnfyfnpujcqlor.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwd2FoeHFuZnlmbnB1amNxbG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyNjM2MjMsImV4cCI6MjA2MTgzOTYyM30.DOFz914BJ9yDHdFVadGcdze0gXku2gnac2Zfyc0PqVc';

// Supabase 클라이언트 생성
// Main 프로세스에서도 세션을 저장할 수 있도록 설정
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: {
      getItem: (key: string) => {
        // Main 프로세스에서는 메모리에 저장
        return (global as any)[`__supabase_${key}`] || null;
      },
      setItem: (key: string, value: string) => {
        (global as any)[`__supabase_${key}`] = value;
      },
      removeItem: (key: string) => {
        delete (global as any)[`__supabase_${key}`];
      },
    },
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Renderer 프로세스의 세션을 Main 프로세스에 설정
 * Renderer에서 로그인한 세션을 Main 프로세스에서 사용할 수 있도록 함
 */
export async function setSessionFromRenderer(accessToken: string, refreshToken: string) {
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    console.error('[Supabase] Failed to set session:', error);
    throw error;
  }

  console.log('[Supabase] Session set successfully, user:', data.user?.id);
  return data;
}

/**
 * 현재 사용자의 agency_id 가져오기
 */
export async function getCurrentUserAgencyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('agency_id')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    console.error('Failed to get user agency_id:', error);
    return null;
  }

  return (data as any).agency_id;
}

// Storage 버킷 이름
export const STORAGE_BUCKET = 'verification-documents';

// Storage 경로 헬퍼 함수
export function getReferenceFilePath(agencyId: string, propertyName: string, dong: string, ho: string, filename: string): string {
  return `reference/${agencyId}/${propertyName}/${dong}/${ho}/${filename}`;
}