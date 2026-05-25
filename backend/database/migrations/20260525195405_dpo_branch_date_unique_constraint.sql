-- Fix unique constraint untuk daily_prep_orders.branch_id + prep_date
-- Constraint sebelumnya tidak memfilter is_deleted, menyebabkan masalah saat re-generate DPO
-- Solusi: Drop constraint lama dan buat partial unique index yang memfilter is_deleted = false

-- Drop constraint lama
ALTER TABLE public.daily_prep_orders DROP CONSTRAINT IF EXISTS daily_prep_orders_branch_date_key;

-- Buat partial unique index sebagai pengganti constraint
-- Ini akan mengizinkan multiple record dengan branch_id + prep_date yang sama selama is_deleted = true
CREATE UNIQUE INDEX idx_dpo_branch_date_active 
  ON public.daily_prep_orders(branch_id, prep_date)
  WHERE is_deleted = false;
