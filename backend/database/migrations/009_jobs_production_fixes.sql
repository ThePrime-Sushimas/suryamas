-- =====================================================
-- Jobs Module: Production Fixes
-- =====================================================

-- Add soft delete columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add indexes for soft delete
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_by ON jobs(updated_by);

-- Add unique constraint for one active job per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_one_active_per_user 
ON jobs(user_id) 
WHERE status IN ('pending', 'processing') AND deleted_at IS NULL;

-- =====================================================
-- Atomic Job State Transition Functions
-- =====================================================

-- Function: Create job atomically (prevents race condition)
CREATE OR REPLACE FUNCTION create_job_atomic(
  p_user_id UUID,
  p_company_id UUID,
  p_type job_type_enum,
  p_name VARCHAR,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS jobs AS $$
DECLARE
  v_job jobs;
BEGIN
  -- Check for existing active job (locked)
  PERFORM 1 FROM jobs
  WHERE user_id = p_user_id
    AND status IN ('pending', 'processing')
    AND deleted_at IS NULL
  FOR UPDATE NOWAIT;
  
  IF FOUND THEN
    RAISE EXCEPTION 'User already has an active job' USING ERRCODE = '23505';
  END IF;
  
  -- Create new job
  INSERT INTO jobs (
    user_id, company_id, type, name, status, progress, metadata, created_by
  ) VALUES (
    p_user_id, p_company_id, p_type, p_name, 'pending', 0, p_metadata, p_user_id
  ) RETURNING * INTO v_job;
  
  RETURN v_job;
END;
$$ LANGUAGE plpgsql;

-- Function: Mark job as processing atomically
CREATE OR REPLACE FUNCTION mark_job_processing_atomic(
  p_job_id UUID
) RETURNS jobs AS $$
DECLARE
  v_job jobs;
BEGIN
  UPDATE jobs SET
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'pending'
    AND deleted_at IS NULL
  RETURNING * INTO v_job;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not in pending state';
  END IF;
  
  RETURN v_job;
END;
$$ LANGUAGE plpgsql;

-- Function: Complete job atomically
CREATE OR REPLACE FUNCTION complete_job_atomic(
  p_job_id UUID,
  p_result_url TEXT,
  p_file_path TEXT,
  p_file_size BIGINT,
  p_expires_at TIMESTAMPTZ,
  p_updated_by UUID
) RETURNS jobs AS $$
DECLARE
  v_job jobs;
BEGIN
  UPDATE jobs SET
    status = 'completed',
    progress = 100,
    result_url = p_result_url,
    file_path = p_file_path,
    file_size = p_file_size,
    completed_at = NOW(),
    expires_at = p_expires_at,
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_job_id
    AND status = 'processing'
    AND deleted_at IS NULL
  RETURNING * INTO v_job;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not in processing state';
  END IF;
  
  RETURN v_job;
END;
$$ LANGUAGE plpgsql;

-- Function: Fail job atomically
CREATE OR REPLACE FUNCTION fail_job_atomic(
  p_job_id UUID,
  p_error_message TEXT,
  p_updated_by UUID
) RETURNS jobs AS $$
DECLARE
  v_job jobs;
BEGIN
  UPDATE jobs SET
    status = 'failed',
    error_message = p_error_message,
    completed_at = NOW(),
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE id = p_job_id
    AND status IN ('pending', 'processing')
    AND deleted_at IS NULL
  RETURNING * INTO v_job;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or not in active state';
  END IF;
  
  RETURN v_job;
END;
$$ LANGUAGE plpgsql;

-- Function: Soft delete job
CREATE OR REPLACE FUNCTION soft_delete_job(
  p_job_id UUID,
  p_user_id UUID,
  p_deleted_by UUID
) RETURNS jobs AS $$
DECLARE
  v_job jobs;
BEGIN
  UPDATE jobs SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    updated_at = NOW(),
    updated_by = p_deleted_by
  WHERE id = p_job_id
    AND user_id = p_user_id
    AND deleted_at IS NULL
  RETURNING * INTO v_job;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or already deleted';
  END IF;
  
  RETURN v_job;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION create_job_atomic IS 'Atomically create job with race condition prevention';
COMMENT ON FUNCTION mark_job_processing_atomic IS 'Atomically transition job to processing state';
COMMENT ON FUNCTION complete_job_atomic IS 'Atomically complete job with file metadata';
COMMENT ON FUNCTION fail_job_atomic IS 'Atomically mark job as failed';
COMMENT ON FUNCTION soft_delete_job IS 'Soft delete job with audit trail';
