-- Migration: Rename batch fields from "remove/upload" to "modify/reAdvertise"
-- 배치 아이템 테이블의 필드명을 "광고 내리기/올리기"에서 "가격 수정/재광고"로 변경

-- Step 1: Rename columns in batch_items table
ALTER TABLE batch_items RENAME COLUMN remove_status TO modify_status;
ALTER TABLE batch_items RENAME COLUMN upload_status TO re_advertise_status;
ALTER TABLE batch_items RENAME COLUMN remove_started_at TO modify_started_at;
ALTER TABLE batch_items RENAME COLUMN remove_completed_at TO modify_completed_at;
ALTER TABLE batch_items RENAME COLUMN upload_started_at TO re_advertise_started_at;
ALTER TABLE batch_items RENAME COLUMN upload_completed_at TO re_advertise_completed_at;

-- Step 2: Update status values in batches table
-- 배치 상태값 변경: removing → modifying, removed → modified, uploading → readvertising
UPDATE batches SET status = 'modifying' WHERE status = 'removing';
UPDATE batches SET status = 'modified' WHERE status = 'removed';
UPDATE batches SET status = 'readvertising' WHERE status = 'uploading';

-- Step 3: Update status values in batch_items table
-- 아이템 상태값 변경
UPDATE batch_items SET status = 'modifying' WHERE status = 'removing';
UPDATE batch_items SET status = 'modified' WHERE status = 'removed';
UPDATE batch_items SET status = 'readvertising' WHERE status = 'uploading';

-- Step 4: Update modify_status and re_advertise_status values
-- 단계별 상태값 업데이트 (기존 remove_status → modify_status)
UPDATE batch_items SET modify_status =
  CASE
    WHEN modify_status = 'removing' THEN 'processing'
    WHEN modify_status = 'removed' THEN 'completed'
    ELSE modify_status
  END;

UPDATE batch_items SET re_advertise_status =
  CASE
    WHEN re_advertise_status = 'uploading' THEN 'processing'
    WHEN re_advertise_status = 'uploaded' THEN 'completed'
    ELSE re_advertise_status
  END;