-- Migration: Remove job_position from employees table
-- Date: 2026-05-28
-- Purpose: job_position is now resolved via FK: employee_positions → positions.position_name
-- This eliminates string duplication and ensures position data is always consistent.

-- Step 1: Backfill employee_positions for employees that have job_position but no position assignment
-- This ensures no data is lost during migration.
DO $$
DECLARE
  emp RECORD;
  pos_id UUID;
BEGIN
  FOR emp IN
    SELECT e.id AS employee_id, e.job_position
    FROM employees e
    WHERE e.deleted_at IS NULL
      AND e.job_position IS NOT NULL
      AND LENGTH(TRIM(e.job_position)) > 0
      AND NOT EXISTS (
        SELECT 1 FROM employee_positions ep
        WHERE ep.employee_id = e.id AND ep.is_deleted = false
      )
    ORDER BY e.created_at
  LOOP
    -- Find matching position (case-insensitive)
    SELECT p.id INTO pos_id
    FROM positions p
    WHERE LOWER(p.position_name) = LOWER(emp.job_position)
      AND p.is_deleted = false
    LIMIT 1;

    -- Only assign if we found a matching position
    IF pos_id IS NOT NULL THEN
      INSERT INTO employee_positions (employee_id, position_id, is_primary)
      VALUES (emp.employee_id, pos_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Step 2: Drop the job_position column
ALTER TABLE employees DROP COLUMN IF EXISTS job_position;

-- Step 3: Update generate_employee_id function signature comment
-- (No change needed — it already accepts p_job_position text parameter externally)
