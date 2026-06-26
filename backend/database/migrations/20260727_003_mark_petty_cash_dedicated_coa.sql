-- ============================================================================
-- MARK DEDICATED PETTY CASH COA ACCOUNTS
-- Akun 110101 dan 110102 dipakai eksklusif oleh source_module = 'petty_cash'.
-- Migration ini HANYA update kolom description — tidak ubah struktur atau nilai lain.
-- ============================================================================
BEGIN;

UPDATE chart_of_accounts
SET description = 'Dedicated untuk modul petty_cash — jangan gunakan source_module lain untuk akun ini.',
    updated_at = NOW()
WHERE account_code = '110101'
  AND deleted_at IS NULL;

UPDATE chart_of_accounts
SET description = 'Dedicated untuk modul petty_cash — jangan gunakan source_module lain untuk akun ini.',
    updated_at = NOW()
WHERE account_code = '110102'
  AND deleted_at IS NULL;

COMMIT;
