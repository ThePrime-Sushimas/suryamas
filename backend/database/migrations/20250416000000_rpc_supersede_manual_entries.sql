CREATE OR REPLACE FUNCTION public.supersede_manual_entries(
  p_superseded_by_id uuid,
  p_transaction_date date,
  p_payment_method_id integer,
  p_branch_id uuid DEFAULT NULL,
  p_branch_name text DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_branch_id IS NULL AND p_branch_name IS NULL THEN
    RAISE EXCEPTION 'Either branch_id or branch_name must be provided';
  END IF;

  RETURN QUERY
  UPDATE aggregated_transactions
  SET
    superseded_by = p_superseded_by_id,
    status = 'SUPERSEDED',
    updated_at = now()
  WHERE source_type = 'POS'
    AND transaction_date = p_transaction_date
    AND payment_method_id = p_payment_method_id
    AND is_reconciled = false
    AND superseded_by IS NULL
    AND deleted_at IS NULL
    AND (
      -- ══════════════════════════════════════════════════════════════
      -- ⚠️ JANGAN HAPUS COMMENT INI — untuk referensi rollback
      --
      -- VERSI AWAL (strict match, gagal untuk CSV manual yang branch_id = NULL):
      --   (p_branch_id IS NOT NULL AND p_branch_name IS NOT NULL
      --     AND branch_id = p_branch_id AND branch_name = p_branch_name)
      --   OR
      --   (p_branch_id IS NOT NULL AND p_branch_name IS NULL
      --     AND branch_id = p_branch_id)
      --   OR
      --   (p_branch_id IS NULL AND p_branch_name IS NOT NULL
      --     AND branch_name = p_branch_name)
      --
      -- ALASAN PERUBAHAN:
      --   CSV manual (source_type='POS') sering punya branch_id = NULL
      --   karena CSV import hanya resolve branch_name, tidak selalu set branch_id.
      --   Kondisi strict (branch_id = p_branch_id) tidak pernah match NULL.
      --   Solusi: prioritaskan branch_name match, karena branch_name selalu terisi
      --   di kedua sisi (POS_SYNC dan CSV manual).
      -- ══════════════════════════════════════════════════════════════

      -- 1. Exact match: kedua field cocok (paling strict)
      (p_branch_id IS NOT NULL AND p_branch_name IS NOT NULL
        AND branch_id = p_branch_id AND branch_name = p_branch_name)
      OR
      -- 2. branch_name match: covers CSV manual yang branch_id = NULL
      (p_branch_name IS NOT NULL AND branch_name = p_branch_name)
      OR
      -- 3. branch_id only: fallback kalau branch_name tidak tersedia
      (p_branch_id IS NOT NULL AND p_branch_name IS NULL
        AND branch_id = p_branch_id)
    )
  RETURNING aggregated_transactions.id;
END;
$$;
