-- Migration: Add IN_DAILY to stock_movements movement_type CHECK constraint
-- 
-- Perubahan: DPO (Daily Prep Orders) sekarang menggunakan movement_type:
--   - OUT_DAILY  (sebelumnya OUT_TRANSFER) — bahan keluar dari gudang MAIN
--   - IN_DAILY   (sebelumnya IN_TRANSFER) — bahan masuk ke gudang READY/kitchen
--
-- Ini untuk membedakan semantik "daily prep" dari transfer antar gudang biasa.
-- OUT_DAILY sudah ada di CHECK constraint, IN_DAILY perlu ditambahkan.

ALTER TABLE IF EXISTS public.stock_movements
DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE IF EXISTS public.stock_movements
ADD CONSTRAINT stock_movements_movement_type_check
CHECK (movement_type::text = ANY (ARRAY[
  'IN_PURCHASE'::character varying,
  'IN_TRANSFER'::character varying,
  'IN_RETURN'::character varying,
  'IN_PRODUCTION'::character varying,
  'IN_ADJUSTMENT'::character varying,
  'IN_OPENING'::character varying,
  'IN_REVERSAL'::character varying,
  'IN_DAILY'::character varying,
  'OUT_TRANSFER'::character varying,
  'OUT_LOAN'::character varying,
  'OUT_DAILY'::character varying,
  'OUT_ADJUSTMENT'::character varying,
  'OUT_WASTE'::character varying,
  'OUT_PRODUCTION'::character varying,
  'OUT_PROCESSING'::character varying,
  'OUT_REVERSAL'::character varying
]::text[]));