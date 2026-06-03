-- Add journal reference columns to stock_transfers
ALTER TABLE stock_transfers
ADD COLUMN IF NOT EXISTS source_journal_id UUID REFERENCES journal_headers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_journal_id UUID REFERENCES journal_headers(id) ON DELETE SET NULL;
