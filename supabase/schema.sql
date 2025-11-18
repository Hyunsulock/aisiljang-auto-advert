-- =====================================================
-- 이실장 자동화 시스템 - Supabase 스키마
-- =====================================================

-- 1. 매물 기본 정보 테이블
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_name TEXT NOT NULL,  -- 아파트명/오피스텔명
  dong TEXT,                     -- 동
  ho TEXT,                       -- 호수

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 복합 유니크 키 (동일 매물 중복 방지)
  UNIQUE(property_name, dong, ho)
);

-- 인덱스: 빠른 조회를 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_properties_lookup
ON properties(property_name, dong, ho);

-- 2. 소유자/검증 정보 테이블
CREATE TABLE IF NOT EXISTS property_verification_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- 검증방식
  verify_type TEXT NOT NULL,     -- '모바일확인', '로켓등록', '신홍보확인서', '전화확인', '구홍보확인서', '현장확인' 등

  -- === 공통: 매물 소유자 정보 ===
  owner_type TEXT NOT NULL,      -- '0'=개인, '1'=법인, '2'=외국인, '3'=위임장
  owner_name TEXT NOT NULL,      -- 등기부상 소유자명 (#inputOname)

  -- === 로켓등록(모바일확인v2) 전용 ===
  owner_phone_1 TEXT,            -- 010
  owner_phone_2 TEXT,            -- 1234
  owner_phone_3 TEXT,            -- 5678
  owner_gender TEXT,             -- '남', '여'

  -- === 신홍보확인서 전용 ===
  client_type TEXT,              -- '0'=소유자 직접의뢰, '1'=대리인 의뢰
  client_name TEXT,              -- 의뢰인 성명 (#inputName)
  client_phone_1 TEXT,           -- 의뢰인 연락처
  client_phone_2 TEXT,
  client_phone_3 TEXT,
  register_unique_no TEXT,       -- 검증 참고란 (#inputRegisterUniqueNo)
  no_register_verify BOOLEAN,    -- 미등기검증요청 (#inputNoRgbkVrfcReqYn)
  naver_id TEXT,                 -- 네이버 실명인증 ID (#inputCNaverId)
  iros_no_1 TEXT,                -- 등기부등본 고유번호 (#inputIrosNo1)
  iros_no_2 TEXT,                -- (#inputIrosNo2)
  iros_no_3 TEXT,                -- (#inputIrosNo3)

  -- === 파일 정보 (Supabase Storage 경로) ===
  -- 등기부등본 (로켓등록 필수, 신홍보는 선택적)
  register_file_type TEXT,       -- 'P'=PDF, 'I'=이미지
  register_file_path TEXT,       -- Storage 경로 (예: "register/고덕그라시움/101/701/register_20250115_123456.pdf")

  -- 서류 첨부 (신홍보확인서 - 분양계약서, 사업자등록증 등)
  reference_file_type TEXT,      -- 'P'=파일통합첨부, 'I'=이미지, 'E'=이메일
  reference_file_path TEXT,      -- Storage 경로
  reference_file_name TEXT,      -- 파일명/서류 종류 (분양계약서, 사업자등록증 등)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- property_id당 하나의 검증 정보만 허용
  UNIQUE(property_id)
);

-- 인덱스: 외래키 조회 최적화
CREATE INDEX IF NOT EXISTS idx_verification_property
ON property_verification_info(property_id);

-- 3. 자동 updated_at 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- properties 테이블 트리거
DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- property_verification_info 테이블 트리거
DROP TRIGGER IF EXISTS update_verification_info_updated_at ON property_verification_info;
CREATE TRIGGER update_verification_info_updated_at
    BEFORE UPDATE ON property_verification_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RPC 함수: 여러 매물의 소유자 정보 조회
-- =====================================================
CREATE OR REPLACE FUNCTION get_properties_by_keys(property_keys jsonb)
RETURNS TABLE (
  id uuid,
  property_name text,
  dong text,
  ho text,
  property_created_at timestamptz,
  property_updated_at timestamptz,
  verification_id uuid,
  verify_type text,
  owner_type text,
  owner_name text,
  owner_phone_1 text,
  owner_phone_2 text,
  owner_phone_3 text,
  owner_gender text,
  client_type text,
  client_name text,
  client_phone_1 text,
  client_phone_2 text,
  client_phone_3 text,
  register_unique_no text,
  no_register_verify boolean,
  naver_id text,
  iros_no_1 text,
  iros_no_2 text,
  iros_no_3 text,
  register_file_type text,
  register_file_path text,
  reference_file_type text,
  reference_file_path text,
  reference_file_name text,
  verification_created_at timestamptz,
  verification_updated_at timestamptz
) AS $$
  SELECT
    p.id,
    p.property_name,
    p.dong,
    p.ho,
    p.created_at as property_created_at,
    p.updated_at as property_updated_at,
    v.id as verification_id,
    v.verify_type,
    v.owner_type,
    v.owner_name,
    v.owner_phone_1,
    v.owner_phone_2,
    v.owner_phone_3,
    v.owner_gender,
    v.client_type,
    v.client_name,
    v.client_phone_1,
    v.client_phone_2,
    v.client_phone_3,
    v.register_unique_no,
    v.no_register_verify,
    v.naver_id,
    v.iros_no_1,
    v.iros_no_2,
    v.iros_no_3,
    v.register_file_type,
    v.register_file_path,
    v.reference_file_type,
    v.reference_file_path,
    v.reference_file_name,
    v.created_at as verification_created_at,
    v.updated_at as verification_updated_at
  FROM properties p
  LEFT JOIN property_verification_info v ON p.id = v.property_id
  WHERE (p.property_name, COALESCE(p.dong, ''), COALESCE(p.ho, '')) IN (
    SELECT
      x->>'name',
      COALESCE(x->>'dong', ''),
      COALESCE(x->>'ho', '')
    FROM jsonb_array_elements(property_keys) x
  )
$$ LANGUAGE sql STABLE;

-- =====================================================
-- Row Level Security (RLS) 설정
-- =====================================================
-- 개발 초기에는 RLS 비활성화, 추후 필요시 활성화
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE property_verification_info DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- Storage Bucket 설정 및 RLS 정책
-- =====================================================
-- Bucket Name: verification-documents
-- Public: false (인증된 사용자만 접근)
-- File Size Limit: 10MB
-- Allowed MIME types: application/pdf, image/jpeg, image/png, image/gif
--
-- Folder Structure (agency별로 격리):
--   /{agency_id}/documents/{property_hash}/{filename}
--   /{agency_id}/registers/{property_hash}/{filename}
--   /{agency_id}/power_of_attorney/{property_hash}/{filename}

-- Storage Bucket에 RLS 활성화
-- Supabase Dashboard에서 'verification-documents' bucket 생성 후 아래 정책을 적용하세요

-- 1. 사용자는 자신의 agency_id 폴더에만 파일을 업로드할 수 있음
CREATE POLICY "Users can upload files to their own agency folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents' AND
  (storage.foldername(name))[1] = (
    SELECT agency_id::text
    FROM user_profiles
    WHERE id = auth.uid()
  )
);

-- 2. 사용자는 자신의 agency_id 폴더의 파일만 조회할 수 있음
CREATE POLICY "Users can view files from their own agency folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  (storage.foldername(name))[1] = (
    SELECT agency_id::text
    FROM user_profiles
    WHERE id = auth.uid()
  )
);

-- 3. 사용자는 자신의 agency_id 폴더의 파일만 업데이트할 수 있음
CREATE POLICY "Users can update files in their own agency folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  (storage.foldername(name))[1] = (
    SELECT agency_id::text
    FROM user_profiles
    WHERE id = auth.uid()
  )
);

-- 4. 사용자는 자신의 agency_id 폴더의 파일만 삭제할 수 있음
CREATE POLICY "Users can delete files from their own agency folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  (storage.foldername(name))[1] = (
    SELECT agency_id::text
    FROM user_profiles
    WHERE id = auth.uid()
  )
);
