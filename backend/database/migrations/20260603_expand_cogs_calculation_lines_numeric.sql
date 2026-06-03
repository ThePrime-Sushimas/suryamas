-- Expand numeric columns in cogs_calculation_lines to handle larger values
ALTER TABLE cogs_calculation_lines
ALTER COLUMN qty_sold TYPE NUMERIC(20,4),
ALTER COLUMN cost_per_unit TYPE NUMERIC(20,4),
ALTER COLUMN total_cogs TYPE NUMERIC(20,4),
ALTER COLUMN revenue TYPE NUMERIC(20,4),
ALTER COLUMN cogs_percentage TYPE NUMERIC(10,4);
