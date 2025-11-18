-- RPC 함수를 새로운 간소화된 스키마에 맞춰 업데이트
CREATE OR REPLACE FUNCTION get_properties_by_keys(property_keys jsonb)
RETURNS TABLE (
  id uuid,
  property_name text,
  dong text,
  ho text,
  property_created_at timestamptz,
  property_updated_at timestamptz,
  verification_id uuid,
  owner_type text,
  document_file_path text,
  register_file_path text,
  power_of_attorney_file_path text,
  register_unique_no text,
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
    v.owner_type,
    v.document_file_path,
    v.register_file_path,
    v.power_of_attorney_file_path,
    v.register_unique_no,
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
