import { createClient } from '@supabase/supabase-js'

// Supabase 설정 - ANON KEY는 공개 키이므로 하드코딩 가능
const supabaseUrl = 'https://wpwahxqnfyfnpujcqlor.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwd2FoeHFuZnlmbnB1amNxbG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyNjM2MjMsImV4cCI6MjA2MTgzOTYyM30.DOFz914BJ9yDHdFVadGcdze0gXku2gnac2Zfyc0PqVc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export interface PropertyOwnerInfo {
  hasOwnerInfo: boolean;
  ownerType?: string; // 개인, 법인, 외국인, 위임장
  files: string[]; // 예: ['서류', '등기부등본', '위임장']
  registerUniqueNo?: string; // 등기부등본 고유번호
  filePaths?: {
    document?: string;
    register?: string;
    powerOfAttorney?: string;
  };
}

/**
 * 여러 매물의 소유자 정보 조회
 */
export async function getPropertyOwnerInfo(
  offers: Array<{ name: string; dong?: string; ho?: string }>
): Promise<Map<string, PropertyOwnerInfo>> {
  if (offers.length === 0) {
    return new Map();
  }

  const propertyKeys = offers.map(o => ({
    name: o.name,
    dong: o.dong || '',
    ho: o.ho || '',
  }));

  const { data, error } = await supabase.rpc('get_properties_by_keys', {
    property_keys: propertyKeys,
  });

  if (error) {
    console.error('❌ 소유자 정보 조회 실패:', error);
    return new Map();
  }

  const resultMap = new Map<string, PropertyOwnerInfo>();

  data?.forEach((item: any) => {
    const key = `${item.property_name}|${item.dong || ''}|${item.ho || ''}`;

    const files: string[] = [];

    // 서류 파일 (항상 있음)
    if (item.document_file_path) {
      files.push('서류');
    }

    // 등기부등본
    if (item.register_file_path) {
      files.push('등기부등본');
    }

    // 위임장
    if (item.power_of_attorney_file_path) {
      files.push('위임장');
    }

    resultMap.set(key, {
      hasOwnerInfo: !!item.verification_id,
      ownerType: item.owner_type,
      files,
      registerUniqueNo: item.register_unique_no,
      filePaths: {
        document: item.document_file_path,
        register: item.register_file_path,
        powerOfAttorney: item.power_of_attorney_file_path,
      },
    });
  });

  return resultMap;
}
