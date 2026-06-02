-- Expand order_number column to accommodate full format: PRD-{branchCode}-{YYYYMMDD}-{seq}
-- Example: PRD-CONDET-20260602-001 = 24 chars, longer branch codes need more room
ALTER TABLE production_orders
ALTER COLUMN order_number TYPE VARCHAR(50);
