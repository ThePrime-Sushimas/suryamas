-- Migration: Add role_id to positions
-- Date: 2026-05-28

-- Step 1: Add role_id column (nullable first for existing data / backfill)
ALTER TABLE positions 
ADD COLUMN role_id UUID REFERENCES perm_roles(id);

-- Step 2: Create index for role_id
CREATE INDEX idx_positions_role 
ON positions(role_id) 
WHERE role_id IS NOT NULL;

COMMENT ON COLUMN positions.role_id IS 'Auto-generated role assigned to this position, mapping Positions directly to Permissions';
