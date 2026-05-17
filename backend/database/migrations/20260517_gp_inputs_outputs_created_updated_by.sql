-- Optional audit: who created/updated GP line rows (run once; IF NOT EXISTS safe to re-run)
ALTER TABLE goods_processing_inputs
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth_users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth_users(id);

ALTER TABLE goods_processing_outputs
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth_users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth_users(id);
