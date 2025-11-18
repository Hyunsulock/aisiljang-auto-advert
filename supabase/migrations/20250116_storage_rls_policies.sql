-- =====================================================
-- Storage RLS 정책 설정
-- 목적: agency별로 파일 접근 권한 격리
-- =====================================================

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Users can upload files to their own agency folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files from their own agency folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update files in their own agency folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from their own agency folder" ON storage.objects;

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
