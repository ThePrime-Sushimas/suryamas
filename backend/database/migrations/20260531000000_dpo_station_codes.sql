-- ============================================================================
-- DPO STATION CODES — Database Migration
-- Adds station_codes column to daily_prep_orders for station filtering
-- ============================================================================

ALTER TABLE daily_prep_orders
  ADD COLUMN station_codes TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN daily_prep_orders.station_codes
  IS 'Position codes selected during DPO generation for station filtering';
