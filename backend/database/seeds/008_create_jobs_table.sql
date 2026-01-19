-- =====================================================
-- Jobs Table for Background Job Queue System
-- =====================================================

-- Create job_type enum
CREATE TYPE job_type_enum AS ENUM ('export', 'import');

-- Create job_status enum
CREATE TYPE job_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Create jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type job_type_enum NOT NULL,
  name VARCHAR(255) NOT NULL,
  status job_status_enum NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  result_url TEXT,
  file_path TEXT,
  file_size BIGINT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_company_id ON jobs(company_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_jobs_expires_at ON jobs(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_jobs_user_status ON jobs(user_id, status);

-- Create composite index for user's recent jobs
CREATE INDEX idx_jobs_user_recent ON jobs(user_id, created_at DESC) WHERE status IN ('pending', 'processing', 'completed');

-- Add comment
COMMENT ON TABLE jobs IS 'Background job queue for export/import operations';
COMMENT ON COLUMN jobs.progress IS 'Job progress percentage (0-100)';
COMMENT ON COLUMN jobs.result_url IS 'Public URL to download result file';
COMMENT ON COLUMN jobs.file_path IS 'Storage path in Supabase Storage';
COMMENT ON COLUMN jobs.expires_at IS 'When the result file expires (1 hour after completion)';
COMMENT ON COLUMN jobs.metadata IS 'Additional job-specific data (filters, options, etc)';

-- =====================================================
-- Supabase Storage Setup
-- =====================================================

-- Create storage bucket for job results
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-results',
  'job-results',
  false, -- Private bucket, requires authentication
  52428800, -- 50MB limit
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel', -- .xls
    'text/csv',
    'application/json'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job results bucket
-- Policy 1: Users can only read their own job result files
CREATE POLICY "Users can read own job results"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'job-results' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Service role can insert files (backend uploads)
CREATE POLICY "Service role can insert job results"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'job-results');

-- Policy 3: Service role can update files
CREATE POLICY "Service role can update job results"
ON storage.objects FOR UPDATE
USING (bucket_id = 'job-results');

-- Policy 4: Service role can delete files
CREATE POLICY "Service role can delete job results"
ON storage.objects FOR DELETE
USING (bucket_id = 'job-results');

-- =====================================================
-- Cleanup Function for Expired Jobs
-- =====================================================

-- Function to cleanup expired job files
CREATE OR REPLACE FUNCTION cleanup_expired_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark expired jobs
  UPDATE jobs
  SET 
    status = 'cancelled',
    updated_at = NOW()
  WHERE 
    expires_at IS NOT NULL 
    AND expires_at < NOW()
    AND status = 'completed';
    
  -- Note: Actual file deletion from storage should be handled by backend cron job
END;
$$;

COMMENT ON FUNCTION cleanup_expired_jobs() IS 'Marks expired jobs as cancelled (files should be deleted by backend cron)';

-- =====================================================
-- RLS Policies for Jobs Table
-- =====================================================

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own jobs
CREATE POLICY "Users can view own jobs"
ON jobs FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Service role has full access (for backend operations)
CREATE POLICY "Service role has full access to jobs"
ON jobs FOR ALL
USING (true)
WITH CHECK (true);

-- =====================================================
-- Trigger for updated_at
-- =====================================================

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
