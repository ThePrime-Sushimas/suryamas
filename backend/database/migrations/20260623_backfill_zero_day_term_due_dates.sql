-- ============================================================
-- Backfill due_date untuk invoice dengan payment term 0 hari
-- (COD, Cash Before Delivery, dll)
--
-- Sebelumnya: isImmediateCashTerm() → due_date = NULL
-- Sekarang:   due_date = tanggal acuan (invoice_date atau gr_received_date)
--
-- Berlaku untuk: calculation_type IN ('from_invoice', 'from_delivery') AND days = 0
-- ============================================================

BEGIN;

-- Preview dulu (opsional untuk verifikasi sebelum commit)
-- SELECT pi.id, pi.invoice_number, pi.invoice_date, pi.status, pt.term_name, computed.due_date
-- FROM ...

UPDATE purchase_invoices pi
SET
  due_date = CASE
    -- from_invoice: acuan = invoice_date
    WHEN pt.calculation_type = 'from_invoice'
      THEN pi.invoice_date
    -- from_delivery: acuan = tanggal terima barang terbaru (GR), fallback ke invoice_date
    ELSE COALESCE(
      (
        SELECT MAX(gr.received_date)
        FROM purchase_invoice_gr_links pigl
        JOIN goods_receipts gr ON gr.id = pigl.goods_receipt_id
        WHERE pigl.purchase_invoice_id = pi.id
          AND pigl.is_deleted = false
          AND gr.deleted_at IS NULL
      ),
      pi.invoice_date
    )
  END,
  updated_at = now()
FROM suppliers s
JOIN payment_terms pt ON pt.id_payment_term = s.payment_term_id
WHERE pi.supplier_id = s.id
  AND pi.due_date IS NULL
  AND pi.deleted_at IS NULL
  AND pt.days = 0
  AND pt.calculation_type IN ('from_invoice', 'from_delivery');

-- Verifikasi hasil
DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM purchase_invoices pi
  JOIN suppliers s ON s.id = pi.supplier_id
  JOIN payment_terms pt ON pt.id_payment_term = s.payment_term_id
  WHERE pi.due_date IS NOT NULL
    AND pi.deleted_at IS NULL
    AND pt.days = 0
    AND pt.calculation_type IN ('from_invoice', 'from_delivery')
    AND pi.updated_at >= now() - interval '5 seconds';

  RAISE NOTICE 'Backfill selesai: % invoice di-update', updated_count;
END;
$$;

COMMIT;
