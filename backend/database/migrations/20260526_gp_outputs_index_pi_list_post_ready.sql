-- Supports purchase invoice list `post_journal_ready` subquery:
-- EXISTS (... goods_processing_outputs gpo ON gpo.goods_processing_id = gpi.goods_processing_id
--         AND gpo.input_id = gpi.id AND gpo.is_waste = FALSE ...)
--
-- Existing indexes (20260513_goods_processing.sql):
--   goods_processing_inputs(gr_line_id), goods_processing_inputs(goods_processing_id)
--   goods_processing_outputs(goods_processing_id), goods_processing_outputs(input_id)
-- This composite partial index helps the (goods_processing_id, input_id) join + is_waste filter.

CREATE INDEX IF NOT EXISTS idx_gp_outputs_proc_input_not_waste
  ON goods_processing_outputs (goods_processing_id, input_id)
  WHERE is_waste = FALSE;
