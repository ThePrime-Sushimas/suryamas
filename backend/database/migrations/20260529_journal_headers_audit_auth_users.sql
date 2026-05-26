-- ============================================================
-- Standardize journal_headers audit FKs: employees → auth_users
-- Backfill: map existing employees.id → employees.user_id
-- reversed_by TIDAK disentuh: FK-nya ke journal_headers(id), bukan user audit
-- ============================================================

-- 1) Drop FK constraints journal_headers → employees (audit columns) FIRST
--    (backfill must run without employees FK, or UPDATE violates constraint)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE t.relname = 'journal_headers'
      AND ref.relname = 'employees'
      AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE journal_headers DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 2) Backfill employee UUIDs → auth_users.id
DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'created_by', 'updated_by', 'submitted_by', 'approved_by',
    'posted_by', 'rejected_by', 'deleted_by'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'journal_headers'
        AND column_name = col
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'UPDATE journal_headers j
       SET %I = e.user_id
       FROM employees e
       WHERE j.%I = e.id
         AND e.user_id IS NOT NULL',
      col, col
    );

    EXECUTE format(
      'UPDATE journal_headers
       SET %I = NULL
       WHERE %I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM auth_users u WHERE u.id = journal_headers.%I)',
      col, col, col
    );
  END LOOP;
END $$;

-- 3) Add FK constraints journal_headers → auth_users (idempotent per column)
DO $$
DECLARE
  col text;
  cname text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'created_by', 'updated_by', 'submitted_by', 'approved_by',
    'posted_by', 'rejected_by', 'deleted_by'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'journal_headers'
        AND column_name = col
    ) THEN
      CONTINUE;
    END IF;

    cname := 'journal_headers_' || col || '_auth_users_fkey';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = cname
    ) THEN
      EXECUTE format(
        'ALTER TABLE journal_headers
         ADD CONSTRAINT %I
         FOREIGN KEY (%I) REFERENCES auth_users(id) ON DELETE SET NULL',
        cname, col
      );
    END IF;
  END LOOP;
END $$;
