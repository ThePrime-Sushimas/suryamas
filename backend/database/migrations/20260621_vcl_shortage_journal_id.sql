-- B2: Add journal_id to variance_classification_lines for shortage RESOLVE journal tracking.
-- When shortage is resolved via payroll deduction, a journal is posted:
--   DR 110403 (Potongan Karyawan)  CR 110505 (Persediaan Cabang)
-- This column links the VCL row(s) to that journal for auditability.

ALTER TABLE variance_classification_lines
  ADD COLUMN IF NOT EXISTS shortage_journal_id UUID REFERENCES journal_headers(id);

COMMENT ON COLUMN variance_classification_lines.shortage_journal_id IS
  'Journal ID from shortage resolve (DR Piutang Karyawan CR Persediaan). NULL if not yet journaled or resolved via CONVERT_TO_WASTE (uses converted_sa_id instead).';
