-- Refresh unconfirm function notes (safe if 20260519 already applied)
CREATE OR REPLACE FUNCTION unconfirm_goods_processing(
  p_gp_id   uuid,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_output RECORD;
  v_sm RECORD;
  v_current_qty NUMERIC(20,4);
  v_current_avg_cost NUMERIC(20,4);
  v_new_qty NUMERIC(20,4);
  v_reversal_qty NUMERIC(20,4);
BEGIN
  FOR v_output IN
    SELECT o.id, o.stock_movement_id
    FROM goods_processing_outputs o
    WHERE o.goods_processing_id = p_gp_id
      AND o.stock_movement_id IS NOT NULL
  LOOP
    SELECT sm.warehouse_id, sm.product_id, sm.qty, sm.cost_per_unit
    INTO v_sm
    FROM stock_movements sm
    WHERE sm.id = v_output.stock_movement_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_reversal_qty := ABS(v_sm.qty);

    SELECT sb.qty, sb.avg_cost
    INTO v_current_qty, v_current_avg_cost
    FROM stock_balances sb
    WHERE sb.warehouse_id = v_sm.warehouse_id
      AND sb.product_id = v_sm.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_current_qty := 0;
      v_current_avg_cost := 0;
    END IF;

    IF v_current_qty < v_reversal_qty THEN
      RAISE EXCEPTION 'Insufficient stock to reverse GP output (product %)', v_sm.product_id
        USING ERRCODE = 'P0001';
    END IF;

    v_new_qty := v_current_qty - v_reversal_qty;

    INSERT INTO stock_movements (
      warehouse_id, product_id, movement_type,
      qty, cost_per_unit, total_cost, balance_after,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_sm.warehouse_id,
      v_sm.product_id,
      'OUT_ADJUSTMENT',
      v_reversal_qty,
      v_sm.cost_per_unit,
      v_reversal_qty * v_sm.cost_per_unit,
      v_new_qty,
      'goods_processing_correction',
      p_gp_id,
      'Pembalikan stok — GP dibuka untuk koreksi (unconfirm)',
      p_user_id
    );

    INSERT INTO stock_balances (warehouse_id, product_id, qty, avg_cost, last_movement_at, updated_at)
    VALUES (v_sm.warehouse_id, v_sm.product_id, v_new_qty, COALESCE(v_current_avg_cost, 0), now(), now())
    ON CONFLICT (warehouse_id, product_id) DO UPDATE SET
      qty = EXCLUDED.qty,
      avg_cost = EXCLUDED.avg_cost,
      last_movement_at = now(),
      updated_at = now();

    UPDATE goods_processing_outputs
    SET stock_movement_id = NULL,
        warehouse_id = NULL,
        updated_by = p_user_id,
        updated_at = now()
    WHERE id = v_output.id;
  END LOOP;

  UPDATE goods_processing_inputs
  SET status = 'PROCESSING',
      updated_by = p_user_id,
      updated_at = now()
  WHERE goods_processing_id = p_gp_id
    AND status = 'DONE';

  UPDATE goods_processing
  SET status = 'CORRECTING',
      updated_by = p_user_id,
      updated_at = now()
  WHERE id = p_gp_id;
END;
$$;
