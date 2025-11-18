-- =====================================================
-- properties 테이블에 agency_id 추가
-- =====================================================

-- 1. agency_id 컬럼 추가
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE;

-- 2. 기존 데이터가 있다면 임시로 첫 번째 agency로 설정 (수동 수정 필요)
-- UPDATE properties SET agency_id = (SELECT id FROM agencies LIMIT 1) WHERE agency_id IS NULL;

-- 3. agency_id를 NOT NULL로 변경 (기존 데이터 정리 후)
-- ALTER TABLE properties ALTER COLUMN agency_id SET NOT NULL;

-- 4. 기존 유니크 제약 조건 삭제
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_property_name_dong_ho_key;

-- 5. 새로운 복합 유니크 제약 조건 추가 (agency_id 포함)
ALTER TABLE properties
ADD CONSTRAINT properties_agency_property_unique
UNIQUE(agency_id, property_name, dong, ho);

-- 6. agency_id 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_properties_agency_id ON properties(agency_id);

-- =====================================================
-- RPC 함수 업데이트: agency_id로 필터링
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
)
SECURITY DEFINER
AS $$
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
  WHERE
    -- 현재 사용자의 agency_id로 필터링
    p.agency_id = (
      SELECT agency_id
      FROM user_profiles
      WHERE id = auth.uid()
    )
    AND
    -- 매물 검색 조건
    (p.property_name, COALESCE(p.dong, ''), COALESCE(p.ho, '')) IN (
      SELECT
        x->>'name',
        COALESCE(x->>'dong', ''),
        COALESCE(x->>'ho', '')
      FROM jsonb_array_elements(property_keys) x
    )
$$ LANGUAGE sql STABLE;

-- =====================================================
-- RLS 정책 추가 (선택사항 - 나중에 활성화)
-- =====================================================

-- properties 테이블에 RLS 정책 추가 (현재는 비활성화 상태)
-- 나중에 ALTER TABLE properties ENABLE ROW LEVEL SECURITY; 실행 시 적용됨

CREATE POLICY IF NOT EXISTS "Users can view properties from their own agency"
ON properties
FOR SELECT
TO authenticated
USING (
  agency_id = (
    SELECT agency_id
    FROM user_profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "Users can insert properties to their own agency"
ON properties
FOR INSERT
TO authenticated
WITH CHECK (
  agency_id = (
    SELECT agency_id
    FROM user_profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "Users can update properties from their own agency"
ON properties
FOR UPDATE
TO authenticated
USING (
  agency_id = (
    SELECT agency_id
    FROM user_profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "Users can delete properties from their own agency"
ON properties
FOR DELETE
TO authenticated
USING (
  agency_id = (
    SELECT agency_id
    FROM user_profiles
    WHERE id = auth.uid()
  )
);
