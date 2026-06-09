#!/usr/bin/env node
/**
 * Script to split the complete SQL schema into per-module files.
 * Reads complete_schema.sql, extracts CREATE TABLE + ALTER TABLE per table,
 * and groups them into module-based SQL files.
 *
 * Usage: node backend/database/scripts/split-schema-by-module.js
 */

const fs = require('fs')
const path = require('path')

// --- CONFIG: Table → Module mapping ---
const TABLE_MODULE_MAP = {
  // Core / Auth
  auth_users: 'auth',
  companies: 'companies',
  chart_of_accounts: 'chart-of-accounts',
  fiscal_periods: 'accounting',

  // Branches
  branches: 'branches',
  branch_opname_config: 'branches',

  // Permissions
  perm_roles: 'permissions',
  perm_role_permissions: 'permissions',
  perm_modules: 'permissions',
  perm_user_profiles: 'permissions',
  perm_audit_log: 'permissions',

  // Employees / HR
  employees: 'employees',
  employee_branches: 'employees',
  employee_positions: 'employees',
  positions: 'positions',
  departments: 'departments',

  // Suppliers
  suppliers: 'suppliers',
  supplier_products: 'suppliers',
  supplier_bank_accounts: 'suppliers',

  // Products
  products: 'products',
  categories: 'products',
  sub_categories: 'products',
  product_uoms: 'products',
  product_output_templates: 'products',
  product_stock_configs: 'products',
  pricelists: 'products',
  pricelist_price_changes: 'products',
  metric_units: 'products',

  // Warehouses / Stock
  warehouses: 'warehouses',
  stock_balances: 'stock',
  stock_movements: 'stock',
  stock_adjustments: 'stock-adjustments',
  stock_adjustment_lines: 'stock-adjustments',
  stock_adjustment_outputs: 'stock-adjustments',
  stock_transfers: 'stock-transfers',
  stock_transfer_lines: 'stock-transfers',

  // Purchasing
  purchase_requests: 'purchase-requests',
  purchase_request_lines: 'purchase-requests',
  purchase_orders: 'purchase-orders',
  purchase_order_lines: 'purchase-orders',
  goods_receipts: 'goods-receipts',
  goods_receipt_lines: 'goods-receipts',
  goods_receipt_attachments: 'goods-receipts',
  invoice_verifications: 'goods-receipts',

  // Purchase Invoices
  purchase_invoices: 'purchase-invoices',
  purchase_invoice_lines: 'purchase-invoices',
  purchase_invoice_gr_links: 'purchase-invoices',
  purchase_invoice_attachments: 'purchase-invoices',
  purchase_invoice_charges: 'purchase-invoices',

  // Goods Processing
  goods_processing: 'goods-processing',
  goods_processing_inputs: 'goods-processing',
  goods_processing_outputs: 'goods-processing',

  // AP Payments
  ap_payments: 'ap-payments',
  ap_payment_batches: 'ap-payments',
  ap_payment_invoice_lines: 'ap-payments',

  // General Invoices
  general_invoices: 'general-invoices',
  general_invoice_lines: 'general-invoices',
  general_invoice_payments: 'general-invoices',
  general_invoice_templates: 'general-invoices',
  general_invoice_template_lines: 'general-invoices',
  general_invoice_amortizations: 'general-invoices',
  general_invoice_amortization_entries: 'general-invoices',
  vendors: 'general-invoices',

  // Accounting / Journal
  journal_headers: 'accounting',
  journal_lines: 'accounting',
  accounting_purposes: 'accounting',
  accounting_purpose_accounts: 'accounting',
  expense_auto_rules: 'accounting',
  account_period_balances: 'accounting',

  // Cash & Bank
  bank_accounts: 'bank-accounts',
  banks: 'bank-accounts',
  bank_statements: 'bank-statements',
  bank_statement_imports: 'bank-statements',
  bank_mutation_entries: 'bank-mutation-entries',
  cash_deposits: 'cash-deposits',
  cash_counts: 'cash-counts',

  // Payment Methods
  payment_methods: 'payment-methods',
  payment_method_groups: 'payment-methods',
  payment_method_group_mappings: 'payment-methods',
  payment_method_alerts: 'payment-methods',
  payment_method_alert_history: 'payment-methods',
  payment_terms: 'payment-terms',

  // POS / Marketplace
  pos_sync_aggregates: 'pos-sync',
  pos_sync_aggregate_lines: 'pos-sync',
  aggregated_transactions: 'pos-sync',
  pos_imports: 'pos-imports',
  pos_import_lines: 'pos-imports',
  marketplace_checkout_sessions: 'marketplace-po',
  marketplace_checkout_lines: 'marketplace-po',
  marketplace_checkout_attachments: 'marketplace-po',
  marketplace_shipments: 'marketplace-po',
  marketplace_settlements: 'marketplace-po',
  owner_credit_cards: 'marketplace-po',

  // Reconciliation
  bank_reconciliation_groups: 'reconciliation',
  bank_reconciliation_group_details: 'reconciliation',
  bank_settlement_groups: 'reconciliation',
  bank_settlement_aggregates: 'reconciliation',
  bank_settlement_statements: 'reconciliation',
  fee_discrepancy_reviews: 'reconciliation',

  // Production / WIP
  wip_items: 'wip',
  wip_ingredients: 'wip',
  wip_position_access: 'wip',
  production_orders: 'production-orders',
  production_order_lines: 'production-orders',
  production_order_materials: 'production-orders',
  production_requests: 'production-requests',
  production_request_lines: 'production-requests',

  // Menus / Recipe
  menus: 'menus',
  menu_categories: 'menus',
  menu_groups: 'menus',
  menu_branch_prices: 'menus',
  recipe_lines: 'menus',

  // COGS
  cogs_calculations: 'cogs',
  cogs_calculation_lines: 'cogs',

  // Daily Prep Orders
  daily_prep_orders: 'daily-prep-orders',
  daily_prep_order_lines: 'daily-prep-orders',
  dpo_forecast_configs: 'daily-prep-orders',

  // Stock Opname
  daily_closing_counts: 'daily-stock-opname',
  daily_closing_count_lines: 'daily-stock-opname',
  variance_classification_lines: 'daily-stock-opname',
  opname_reopen_requests: 'daily-stock-opname',

  // Other
  jobs: 'jobs',
  printers: 'printers',
  notifications: 'notifications',
  notification_rules: 'notifications',
  public_holidays: 'public-holidays',
  goods_receipt_attachments: 'goods-receipts',
}

// --- Parse SQL ---
const sqlFile = path.join(__dirname, '..', 'complete_schema.sql')
const outputDir = path.join(__dirname, '..', 'by-module')

if (!fs.existsSync(sqlFile)) {
  console.error('File not found:', sqlFile)
  console.error('Please save the complete SQL to backend/database/complete_schema.sql first')
  process.exit(1)
}

fs.mkdirSync(outputDir, { recursive: true })

const sql = fs.readFileSync(sqlFile, 'utf-8')

// Extract all CREATE TABLE statements
const tableRegex = /CREATE TABLE IF NOT EXISTS public\.(\w+)\s*\((.*?)\);/gs
const alterRegex = /ALTER TABLE IF EXISTS public\.(\w+)\s+ADD\s+CONSTRAINT.*?;/gs
const commentRegex = /COMMENT ON (TABLE|COLUMN) public\.(\w+(?:\.\w+)?).*?;/gs
const indexRegex = /CREATE INDEX IF NOT EXISTS.*?ON public\.(\w+).*?;/gs

// Collect tables
const tables = new Map()
let match

while ((match = tableRegex.exec(sql)) !== null) {
  const tableName = match[0].match(/public\.(\w+)/)[1]
  if (!tables.has(tableName)) {
    tables.set(tableName, { create: [], alter: [], comment: [], index: [] })
  }
  tables.get(tableName).create.push(match[0])
}

// Collect ALTER TABLE
while ((match = alterRegex.exec(sql)) !== null) {
  const tableName = match[1]
  if (!tables.has(tableName)) {
    tables.set(tableName, { create: [], alter: [], comment: [], index: [] })
  }
  tables.get(tableName).alter.push(match[0])
}

// Collect COMMENT ON
while ((match = commentRegex.exec(sql)) !== null) {
  const ref = match[2]
  const tableName = ref.includes('.') ? ref.split('.')[0] : ref
  if (!tables.has(tableName)) {
    tables.set(tableName, { create: [], alter: [], comment: [], index: [] })
  }
  tables.get(tableName).comment.push(match[0])
}

// Collect CREATE INDEX
while ((match = indexRegex.exec(sql)) !== null) {
  const tableName = match[1]
  if (!tables.has(tableName)) {
    tables.set(tableName, { create: [], alter: [], comment: [], index: [] })
  }
  tables.get(tableName).index.push(match[0])
}

// Group by module
const moduleFiles = new Map()

for (const [tableName, stmts] of tables) {
  const moduleName = TABLE_MODULE_MAP[tableName]
  if (!moduleName) {
    console.warn(`⚠️  No module mapping for table: ${tableName} — adding to _unmapped`)
    const unmappedKey = '_unmapped'
    if (!moduleFiles.has(unmappedKey)) moduleFiles.set(unmappedKey, [])
    moduleFiles.get(unmappedKey).push({ tableName, ...stmts })
    continue
  }
  if (!moduleFiles.has(moduleName)) moduleFiles.set(moduleName, [])
  moduleFiles.get(moduleName).push({ tableName, ...stmts })
}

// Write per-module files
for (const [moduleName, tableList] of moduleFiles) {
  const lines = ['-- ============================================', `-- Module: ${moduleName}`, `-- Generated: ${new Date().toISOString()}`, '-- ============================================', '', 'BEGIN;', '']

  for (const tbl of tableList) {
    if (tbl.create.length > 0) {
      lines.push(...tbl.create, '')
    }
    if (tbl.comment.length > 0) {
      lines.push(...tbl.comment, '')
    }
    if (tbl.index.length > 0) {
      lines.push(...tbl.index, '')
    }
    if (tbl.alter.length > 0) {
      lines.push(...tbl.alter, '')
    }
  }

  lines.push('', 'END;')

  const filename = `${moduleName}.sql`
  const filepath = path.join(outputDir, filename)
  fs.writeFileSync(filepath, lines.join('\n'), 'utf-8')
  console.log(`✅ ${filename} (${tableList.length} tables)`)
}

// Also write a summary
const summary = ['# Schema by Module', '', 'Generated from complete_schema.sql', '', '| Module | File | Tables |', '|--------|------|--------|']
for (const [moduleName, tableList] of moduleFiles) {
  summary.push(`| ${moduleName} | ${moduleName}.sql | ${tableList.length} |`)
}
fs.writeFileSync(path.join(outputDir, '_INDEX.md'), summary.join('\n'), 'utf-8')
console.log(`\n📋 Total: ${moduleFiles.size} modules, ${tables.size} tables`)
console.log(`📁 Output: ${outputDir}`)