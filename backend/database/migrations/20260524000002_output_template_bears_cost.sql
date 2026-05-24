-- Add bears_cost flag to product_output_templates
-- When true, this output product absorbs the input cost during goods processing
-- By-products (kepala, ekor, etc.) should be false so cost concentrates on main output

ALTER TABLE public.product_output_templates
  ADD COLUMN IF NOT EXISTS bears_cost boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.product_output_templates.bears_cost IS
  'If true, this output absorbs proportional input cost. False = by-product (cost = 0).';
