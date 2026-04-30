-- ============================================================================
-- Migration Part 3: Triggers (from Supabase)
-- ============================================================================

-- account_period_balances
CREATE OR REPLACE TRIGGER trg_apb_updated_at
  BEFORE UPDATE ON account_period_balances
  FOR EACH ROW EXECUTE FUNCTION update_account_period_balances_updated_at();

-- aggregated_transactions
CREATE OR REPLACE TRIGGER trigger_aggregated_transactions_updated_at
  BEFORE UPDATE ON aggregated_transactions
  FOR EACH ROW EXECUTE FUNCTION update_aggregated_transactions_updated_at();

CREATE OR REPLACE TRIGGER trg_sync_pos_sync_reconciliation
  AFTER UPDATE ON aggregated_transactions
  FOR EACH ROW EXECUTE FUNCTION sync_pos_sync_reconciliation();

-- bank_accounts
CREATE OR REPLACE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- bank_mutation_entries
CREATE OR REPLACE TRIGGER trg_bme_updated_at
  BEFORE UPDATE ON bank_mutation_entries
  FOR EACH ROW EXECUTE FUNCTION update_bank_mutation_entries_updated_at();

-- bank_settlement_groups
CREATE OR REPLACE TRIGGER set_bank_settlement_number
  BEFORE INSERT ON bank_settlement_groups
  FOR EACH ROW EXECUTE FUNCTION set_bank_settlement_number_on_insert();

CREATE OR REPLACE TRIGGER update_bank_settlement_groups_updated_at
  BEFORE UPDATE ON bank_settlement_groups
  FOR EACH ROW EXECUTE FUNCTION update_bank_settlement_groups_updated_at();

-- bank_statements
CREATE OR REPLACE TRIGGER update_bank_statements_updated_at
  BEFORE UPDATE ON bank_statements
  FOR EACH ROW EXECUTE FUNCTION update_bank_statements_updated_at();

-- banks
CREATE OR REPLACE TRIGGER update_banks_updated_at
  BEFORE UPDATE ON banks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- cash_counts
CREATE OR REPLACE TRIGGER trg_cash_counts_updated_at
  BEFORE UPDATE ON cash_counts
  FOR EACH ROW EXECUTE FUNCTION update_cash_counts_updated_at();

-- cash_deposits
CREATE OR REPLACE TRIGGER trg_cash_deposits_updated_at
  BEFORE UPDATE ON cash_deposits
  FOR EACH ROW EXECUTE FUNCTION update_cash_deposits_updated_at();

-- chart_of_accounts
CREATE OR REPLACE TRIGGER before_insert_update_coa
  BEFORE INSERT OR UPDATE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION trg_set_account_path();

-- jobs
CREATE OR REPLACE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- journal_headers
CREATE OR REPLACE TRIGGER trigger_set_journal_period
  BEFORE INSERT OR UPDATE ON journal_headers
  FOR EACH ROW EXECUTE FUNCTION set_journal_period();

-- metric_units
CREATE OR REPLACE TRIGGER update_metric_units_timestamp
  BEFORE UPDATE ON metric_units
  FOR EACH ROW EXECUTE FUNCTION update_metric_units_updated_at_and_by();

-- payment_method_groups
CREATE OR REPLACE TRIGGER trg_pmg_updated_at
  BEFORE UPDATE ON payment_method_groups
  FOR EACH ROW EXECUTE FUNCTION update_pmg_updated_at();

-- payment_methods
CREATE OR REPLACE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- payment_terms
CREATE OR REPLACE TRIGGER trg_payment_terms_updated_at
  BEFORE UPDATE ON payment_terms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- perm_modules
CREATE OR REPLACE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON perm_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- perm_role_permissions
CREATE OR REPLACE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON perm_role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- perm_roles
CREATE OR REPLACE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON perm_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- perm_user_profiles
CREATE OR REPLACE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON perm_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pos_staging_branches
CREATE OR REPLACE TRIGGER trg_pos_staging_branches_updated_at
  BEFORE UPDATE ON pos_staging_branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pos_staging_menu_categories
CREATE OR REPLACE TRIGGER trg_pos_staging_menu_categories_updated_at
  BEFORE UPDATE ON pos_staging_menu_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pos_staging_menu_groups
CREATE OR REPLACE TRIGGER trg_pos_staging_menu_groups_updated_at
  BEFORE UPDATE ON pos_staging_menu_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pos_staging_menus
CREATE OR REPLACE TRIGGER trg_pos_staging_menus_updated_at
  BEFORE UPDATE ON pos_staging_menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pos_staging_payment_methods
CREATE OR REPLACE TRIGGER trg_pos_staging_payment_methods_updated_at
  BEFORE UPDATE ON pos_staging_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pricelists
CREATE OR REPLACE TRIGGER trg_pricelists_updated_at
  BEFORE UPDATE ON pricelists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- product_uoms
CREATE OR REPLACE TRIGGER trigger_update_product_default_purchase_unit
  AFTER INSERT OR UPDATE OR DELETE ON product_uoms
  FOR EACH ROW EXECUTE FUNCTION update_product_default_purchase_unit();

CREATE OR REPLACE TRIGGER trigger_update_product_uoms_updated_at
  BEFORE UPDATE ON product_uoms
  FOR EACH ROW EXECUTE FUNCTION update_product_uoms_updated_at();

-- products
CREATE OR REPLACE TRIGGER trigger_update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_products_updated_at();

-- supplier_products
CREATE OR REPLACE TRIGGER update_supplier_products_updated_at
  BEFORE UPDATE ON supplier_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- suppliers
CREATE OR REPLACE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
