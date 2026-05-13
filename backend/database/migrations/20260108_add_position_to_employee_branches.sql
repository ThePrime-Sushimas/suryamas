-- Migration: Add position_id to employee_branches
-- Purpose: Link position to branch assignment (Employee A = Barista di Serpong, Server di Condet)
-- Date: 2026-01-08

-- Step 1: Add position_id column (nullable first for existing data)
ALTER TABLE employee_branches 
ADD COLUMN position_id UUID REFERENCES positions(id);

-- Step 2: Create index for position_id
CREATE INDEX idx_employee_branches_position 
ON employee_branches(position_id) 
WHERE position_id IS NOT NULL;

-- Step 3: Add comment
COMMENT ON COLUMN employee_branches.position_id IS 'Position of employee at this specific branch (e.g., Barista at Serpong, Server at Condet)';

-- Note: position_id is nullable to support:
-- 1. Backward compatibility with existing data
-- 2. Employees who are assigned to branch but position not yet determined
-- 3. Office staff who don't have operational position

-- Migration rollback (if needed):
-- ALTER TABLE employee_branches DROP COLUMN position_id;
-- DROP INDEX idx_employee_branches_position;
