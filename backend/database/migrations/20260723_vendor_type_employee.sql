-- ============================================================
-- Migration: Add EMPLOYEE to vendors.vendor_type CHECK constraint
-- Purpose: Support employee reimbursement via General AP module
-- ============================================================

-- Drop existing constraint
ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_vendor_type_check;

-- Recreate with EMPLOYEE added
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_vendor_type_check CHECK (
    vendor_type IS NULL OR vendor_type = ANY (
      ARRAY['UTILITY','RENT','SERVICE','SUBSCRIPTION','OTHER','EMPLOYEE']
    )
  );
