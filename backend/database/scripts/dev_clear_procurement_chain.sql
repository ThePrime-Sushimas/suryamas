-- ============================================================
-- DEV HELPER: Clear Transactional Data (Keep Master + Source of Truth)
-- Safe untuk dijalankan di database development/local.
--
-- DIPERTAHANKAN (tidak dihapus):
--   Master      : companies, branches, auth_users, employees, positions,
--                 departments, chart_of_accounts, fiscal_periods, banks,
--                 bank_accounts, payment_methods, payment_terms, products,
--                 categories, sub_categories, metric_units, product_uoms,
--                 product_output_templates, product_stock_configs,
--                 warehouses, suppliers, pricelists, wip_items,
--                 wip_ingredients, wip_position_access, menus,
--                 menu_categories, menu_groups, recipe_lines,
--                 menu_branch_prices, perm_roles, perm_modules,
--                 perm_role_permissions, perm_user_profiles, printers,
--                 owner_credit_cards, dpo_forecast_configs,
--                 branch_opname_config, public_holidays,
--                 accounting_purposes, accounting_purpose_accounts,
--                 expense_auto_rules, notification_rules,
--                 payment_method_groups, payment_method_group_mappings,
--                 payment_method_alerts, supplier_products,
--                 asset_categories,
--                 general_invoice_templates, general_invoice_template_lines
--   HR          : employee_branches, employee_positions
--                 (diperlukan agar login & branch guard tetap berfungsi)
--   POS Source  : pos_imports, pos_import_lines,
--                 pos_sync_aggregates, pos_sync_aggregate_lines,
--                 aggregated_transactions
--                 (source of truth — jangan pernah dihapus)
--
-- FK dependency order generated from information_schema.table_constraints.
--
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--        -f backend/database/scripts/dev_clear_procurement_chain.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 0. BREAK CIRCULAR REFERENCES
--    Beberapa tabel saling referensi via journal_headers dan
--    stock_movements. NULL-kan FK nullable dulu supaya delete lancar.
-- ============================================================
UPDATE journal_headers SET reversed_by = NULL WHERE reversed_by IS NOT NULL;
UPDATE goods_receipts SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE production_orders SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE purchase_invoices SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE general_invoices SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE ap_payments SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE stock_transfers SET source_journal_id = NULL, target_journal_id = NULL
  WHERE source_journal_id IS NOT NULL OR target_journal_id IS NOT NULL;
UPDATE marketplace_checkout_sessions
  SET journal_ordered_id = NULL, journal_received_id = NULL, journal_settled_id = NULL
  WHERE journal_ordered_id IS NOT NULL
     OR journal_received_id IS NOT NULL
     OR journal_settled_id IS NOT NULL;
UPDATE marketplace_settlements SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE fixed_assets SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE fixed_assets SET purchase_invoice_id = NULL WHERE purchase_invoice_id IS NOT NULL;
UPDATE fixed_assets SET gr_line_id = NULL WHERE gr_line_id IS NOT NULL;
UPDATE asset_maintenance SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE asset_disposals SET journal_id = NULL WHERE journal_id IS NOT NULL;
UPDATE asset_depreciation_runs SET journal_ids = NULL, reversal_journal_ids = NULL
  WHERE journal_ids IS NOT NULL OR reversal_journal_ids IS NOT NULL;

-- NULL-kan FK ke stock_movements dari tabel yang dihapus belakangan
UPDATE daily_prep_order_lines SET in_movement_id = NULL, out_movement_id = NULL
  WHERE in_movement_id IS NOT NULL OR out_movement_id IS NOT NULL;
UPDATE goods_processing_outputs SET stock_movement_id = NULL WHERE stock_movement_id IS NOT NULL;
UPDATE production_order_lines SET stock_movement_in_id = NULL WHERE stock_movement_in_id IS NOT NULL;
UPDATE production_order_materials SET stock_movement_out_id = NULL, stock_movement_in_id = NULL
  WHERE stock_movement_out_id IS NOT NULL OR stock_movement_in_id IS NOT NULL;

-- NULL-kan FK ke stock_transfers
UPDATE production_requests SET stock_transfer_id = NULL WHERE stock_transfer_id IS NOT NULL;

-- NULL-kan FK pricelists → purchase_invoices (master table, jangan delete)
UPDATE pricelists SET purchase_invoice_id = NULL WHERE purchase_invoice_id IS NOT NULL;

-- ============================================================
-- 1. DAILY PREP ORDERS (DPO)
--    dpo_lines → stock_movements, daily_prep_orders
-- ============================================================
DELETE FROM daily_prep_order_lines;
DELETE FROM daily_prep_orders;

-- ============================================================
-- 2. PRODUCTION (Orders, Requests)
--    materials → lines → orders; requests → stock_transfers
-- ============================================================
DELETE FROM production_order_materials;
DELETE FROM production_order_lines;
DELETE FROM production_orders;
DELETE FROM production_request_lines;
DELETE FROM production_requests;

-- ============================================================
-- 3. GOODS PROCESSING (GP)
--    outputs → inputs → goods_receipt_lines
--    outputs → stock_movements
-- ============================================================
DELETE FROM goods_processing_outputs;
DELETE FROM goods_processing_inputs;
DELETE FROM goods_processing;

-- ============================================================
-- 4. PRICELIST PRICE CHANGES
--    → purchase_invoice_lines, purchase_invoices
-- ============================================================
DELETE FROM pricelist_price_changes;

-- ============================================================
-- 5. AP PAYMENTS
--    ap_payment_invoice_lines → purchase_invoices
-- ============================================================
DELETE FROM ap_payment_invoice_lines;
DELETE FROM ap_payment_batches;
DELETE FROM ap_payments;

-- ============================================================
-- 6. FIXED ASSETS (Transactional Data Only)
--    asset_categories dipertahankan sebagai master data.
--    Semua FK (journal_id, gr_line_id, purchase_invoice_id) sudah
--    di-NULL-kan di step 0.
-- ============================================================
DELETE FROM asset_depreciation_entries;
DELETE FROM asset_depreciation_runs;
DELETE FROM asset_movements;
DELETE FROM asset_disposals;
DELETE FROM asset_maintenance;
DELETE FROM asset_transfers;
DELETE FROM fixed_assets;

-- ============================================================
-- 7. PURCHASE INVOICES (PI)
--    lines → goods_receipt_lines; gr_links → goods_receipts
-- ============================================================
DELETE FROM purchase_invoice_charges;
DELETE FROM purchase_invoice_gr_links;
DELETE FROM purchase_invoice_lines;
DELETE FROM purchase_invoice_attachments;
DELETE FROM purchase_invoices;

-- ============================================================
-- 8. MARKETPLACE PO & SETTLEMENTS
--    lines/shipments/settlements → sessions
--    sessions → goods_receipts, purchase_order_lines
-- ============================================================
DELETE FROM marketplace_checkout_lines;
DELETE FROM marketplace_shipments;
DELETE FROM marketplace_settlements;
DELETE FROM marketplace_checkout_attachments;
DELETE FROM marketplace_checkout_sessions;

-- ============================================================
-- 9. GOODS RECEIPTS (GR)
--    lines → purchase_order_lines; GR → purchase_orders
-- ============================================================
DELETE FROM invoice_verifications;
DELETE FROM goods_receipt_lines;
DELETE FROM goods_receipt_attachments;
DELETE FROM goods_receipts;

-- ============================================================
-- 10. PURCHASE ORDERS (PO)
--    lines → purchase_request_lines; PO → purchase_requests
-- ============================================================
DELETE FROM purchase_order_lines;
DELETE FROM purchase_orders;

-- ============================================================
-- 11. PURCHASE REQUESTS (PR)
-- ============================================================
DELETE FROM purchase_request_lines;
DELETE FROM purchase_requests;

-- ============================================================
-- 12. GENERAL INVOICES & AMORTIZATIONS
--     NOTE: general_invoice_templates dan general_invoice_template_lines
--     adalah MASTER DATA dan TIDAK dihapus.
-- ============================================================
DELETE FROM general_invoice_amortization_entries;
DELETE FROM general_invoice_amortizations;
DELETE FROM general_invoice_lines;
DELETE FROM general_invoice_payments;
DELETE FROM general_invoices;
-- general_invoice_templates dan general_invoice_template_lines dipertahankan

-- ============================================================
-- 13. STOCK: MOVEMENTS, BALANCES, TRANSFERS, ADJUSTMENTS
-- ============================================================
DELETE FROM stock_adjustment_lines;
DELETE FROM stock_adjustment_outputs;
DELETE FROM stock_adjustments;
DELETE FROM stock_transfer_lines;
DELETE FROM stock_transfers;
DELETE FROM stock_movements;
DELETE FROM stock_balances;

-- ============================================================
-- 14. DAILY CLOSING / STOCK OPNAME
-- ============================================================
DELETE FROM variance_classification_lines;
DELETE FROM opname_reopen_requests;
DELETE FROM daily_closing_count_lines;
DELETE FROM daily_closing_counts;

-- ============================================================
-- 15. COGS CALCULATIONS
-- ============================================================
DELETE FROM cogs_calculation_lines;
DELETE FROM cogs_calculations;

-- ============================================================
-- 16. MENU PRICING (Transaction Data Only)
--     NOTE: recipe_lines dan menu_branch_prices sekarang dianggap
--     MASTER DATA dan TIDAK dihapus. Sudah ditambahkan ke daftar
--     "DIPERTAHANKAN" di header.
-- ============================================================
-- (Tidak ada yang dihapus di step ini)

-- ============================================================
-- 17. BANK STATEMENTS & REKONSILIASI
--    bank_statements.journal_id sudah di-NULL-kan di step 0
-- ============================================================
DELETE FROM bank_settlement_aggregates;
DELETE FROM bank_settlement_statements;
DELETE FROM bank_settlement_groups;
DELETE FROM bank_reconciliation_group_details;
DELETE FROM bank_statements;
DELETE FROM bank_reconciliation_groups;
DELETE FROM bank_statement_imports;
DELETE FROM bank_mutation_entries;
DELETE FROM account_period_balances;
DELETE FROM fee_discrepancy_reviews;

-- ============================================================
-- 18. JOURNAL ENTRIES
--    Semua FK ke journal_headers sudah di-NULL-kan di step 0
-- ============================================================
DELETE FROM journal_lines;
DELETE FROM journal_headers;

-- ============================================================
-- 19. CASH DEPOSITS & COUNTS
-- ============================================================
DELETE FROM cash_deposits;
DELETE FROM cash_counts;

-- ============================================================
-- 20. NOTIFICATIONS & ALERTS (History Only)
-- ============================================================
DELETE FROM payment_method_alert_history;
DELETE FROM notifications;

-- ============================================================
-- 21. JOBS (Async task records)
-- ============================================================
DELETE FROM jobs;

-- ============================================================
-- 22. AUDIT LOGS
-- ============================================================
DELETE FROM perm_audit_log;

-- ============================================================
-- DONE
-- ============================================================

COMMIT;

-- ============================================================
-- Summary — verifikasi semua tabel sudah bersih
-- ============================================================
SELECT tbl, remaining FROM (
  SELECT 'purchase_requests'          AS tbl, COUNT(*)::int AS remaining FROM purchase_requests
  UNION ALL SELECT 'purchase_orders',          COUNT(*)::int FROM purchase_orders
  UNION ALL SELECT 'goods_receipts',           COUNT(*)::int FROM goods_receipts
  UNION ALL SELECT 'goods_processing',         COUNT(*)::int FROM goods_processing
  UNION ALL SELECT 'purchase_invoices',        COUNT(*)::int FROM purchase_invoices
  UNION ALL SELECT 'ap_payments',              COUNT(*)::int FROM ap_payments
  UNION ALL SELECT 'general_invoices',         COUNT(*)::int FROM general_invoices
  UNION ALL SELECT 'marketplace_sessions',     COUNT(*)::int FROM marketplace_checkout_sessions
  UNION ALL SELECT 'stock_movements',          COUNT(*)::int FROM stock_movements
  UNION ALL SELECT 'stock_balances',           COUNT(*)::int FROM stock_balances
  UNION ALL SELECT 'stock_transfers',          COUNT(*)::int FROM stock_transfers
  UNION ALL SELECT 'stock_adjustments',        COUNT(*)::int FROM stock_adjustments
  UNION ALL SELECT 'daily_closing_counts',     COUNT(*)::int FROM daily_closing_counts
  UNION ALL SELECT 'daily_prep_orders',        COUNT(*)::int FROM daily_prep_orders
  UNION ALL SELECT 'production_orders',        COUNT(*)::int FROM production_orders
  UNION ALL SELECT 'production_requests',      COUNT(*)::int FROM production_requests
  UNION ALL SELECT 'cogs_calculations',        COUNT(*)::int FROM cogs_calculations
  UNION ALL SELECT 'journal_headers',          COUNT(*)::int FROM journal_headers
  UNION ALL SELECT 'bank_statements',          COUNT(*)::int FROM bank_statements
  UNION ALL SELECT 'cash_deposits',            COUNT(*)::int FROM cash_deposits
  UNION ALL SELECT 'pricelist_price_changes',  COUNT(*)::int FROM pricelist_price_changes
  UNION ALL SELECT 'fixed_assets',             COUNT(*)::int FROM fixed_assets
  -- Master data — harus TETAP ada isinya
  UNION ALL SELECT '⚑ general_invoice_templates (kept)', COUNT(*)::int FROM general_invoice_templates
  UNION ALL SELECT '⚑ pos_imports (kept)',       COUNT(*)::int FROM pos_imports
  UNION ALL SELECT '⚑ pos_sync_aggregates (kept)', COUNT(*)::int FROM pos_sync_aggregates
  UNION ALL SELECT '⚑ aggregated_transactions (kept)', COUNT(*)::int FROM aggregated_transactions
  UNION ALL SELECT '⚑ employee_branches (kept)', COUNT(*)::int FROM employee_branches
) sub
ORDER BY tbl;