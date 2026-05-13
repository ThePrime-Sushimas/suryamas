/**
 * Error Registry Configuration
 * Registry untuk semua module error classes
 * Digunakan oleh error handler untuk dynamic loading
 */

export interface ModuleErrorConfig {
  name: string;
  importPath: string;
  defaultStatusCode: number;
  category: string;
}

export const ERROR_REGISTRY = {
  // ============ RECONCILIATION MODULE ============
  BankStatementImportError: {
    name: 'BankStatementImportError',
    importPath: '../modules/reconciliation/bank-statement-import/bank-statement-import.errors',
    defaultStatusCode: 400,
    category: 'reconciliation',
  },
  ReconciliationError: {
    name: 'ReconciliationError',
    importPath: '../modules/reconciliation/bank-reconciliation/bank-reconciliation.errors',
    defaultStatusCode: 400,
    category: 'reconciliation',
  },
  AlreadyReconciledError: {
    name: 'AlreadyReconciledError',
    importPath: '../modules/reconciliation/bank-reconciliation/bank-reconciliation.errors',
    defaultStatusCode: 409,
    category: 'reconciliation',
  },
  DifferenceThresholdExceededError: {
    name: 'DifferenceThresholdExceededError',
    importPath: '../modules/reconciliation/bank-reconciliation/bank-reconciliation.errors',
    defaultStatusCode: 422,
    category: 'reconciliation',
  },
  FetchStatementError: {
    name: 'FetchStatementError',
    importPath: '../modules/reconciliation/bank-reconciliation/bank-reconciliation.errors',
    defaultStatusCode: 503,
    category: 'reconciliation',
  },
  StatementNotFoundError: {
    name: 'StatementNotFoundError',
    importPath: '../modules/reconciliation/bank-reconciliation/bank-reconciliation.errors',
    defaultStatusCode: 404,
    category: 'reconciliation',
  },
  NoMatchFoundError: {
    name: 'NoMatchFoundError',
    importPath: '../modules/reconciliation/bank-reconciliation/bank-reconciliation.errors',
    defaultStatusCode: 404,
    category: 'reconciliation',
  },
  DatabaseConnectionError: {
    name: 'DatabaseConnectionError',
    importPath: '../modules/reconciliation/bank-reconciliation/bank-reconciliation.errors',
    defaultStatusCode: 503,
    category: 'reconciliation',
  },
  SettlementGroupError: {
    name: 'SettlementGroupError',
    importPath: '../modules/reconciliation/bank-settlement-group/bank-settlement-group.errors',
    defaultStatusCode: 400,
    category: 'reconciliation',
  },
  DuplicateAggregateError: {
    name: 'DuplicateAggregateError',
    importPath: '../modules/reconciliation/bank-settlement-group/bank-settlement-group.errors',
    defaultStatusCode: 409,
    category: 'reconciliation',
  },
  AggregateAlreadyReconciledError: {
    name: 'AggregateAlreadyReconciledError',
    importPath: '../modules/reconciliation/bank-settlement-group/bank-settlement-group.errors',
    defaultStatusCode: 409,
    category: 'reconciliation',
  },
  StatementAlreadyReconciledError: {
    name: 'StatementAlreadyReconciledError',
    importPath: '../modules/reconciliation/bank-settlement-group/bank-settlement-group.errors',
    defaultStatusCode: 409,
    category: 'reconciliation',
  },
  SettlementAlreadyConfirmedError: {
    name: 'SettlementAlreadyConfirmedError',
    importPath: '../modules/reconciliation/bank-settlement-group/bank-settlement-group.errors',
    defaultStatusCode: 409,
    category: 'reconciliation',
  },
  SettlementGroupNotFoundError: {
    name: 'SettlementGroupNotFoundError',
    importPath: '../modules/reconciliation/bank-settlement-group/bank-settlement-group.errors',
    defaultStatusCode: 404,
    category: 'reconciliation',
  },

  // ============ ACCOUNTING MODULE ============
  ChartOfAccountError: {
    name: 'ChartOfAccountError',
    importPath: '../modules/accounting/chart-of-accounts/chart-of-accounts.errors',
    defaultStatusCode: 400,
    category: 'accounting',
  },
  FiscalPeriodError: {
    name: 'FiscalPeriodError',
    importPath: '../modules/accounting/fiscal-periods/fiscal-periods.errors',
    defaultStatusCode: 400,
    category: 'accounting',
  },
  AccountingPurposeError: {
    name: 'AccountingPurposeError',
    importPath: '../modules/accounting/accounting-purposes/accounting-purposes.errors',
    defaultStatusCode: 400,
    category: 'accounting',
  },
  AccountingPurposeAccountError: {
    name: 'AccountingPurposeAccountError',
    importPath: '../modules/accounting/accounting-purpose-accounts/accounting-purpose-accounts.errors',
    defaultStatusCode: 400,
    category: 'accounting',
  },

  // ============ CORE MODULES ============
  EmployeeNotFoundError: {
    name: 'EmployeeNotFoundError',
    importPath: '../modules/employees/employees.errors',
    defaultStatusCode: 404,
    category: 'hr',
  },
  EmployeeConflictError: {
    name: 'EmployeeConflictError',
    importPath: '../modules/employees/employees.errors',
    defaultStatusCode: 409,
    category: 'hr',
  },
  EmployeeValidationError: {
    name: 'EmployeeValidationError',
    importPath: '../modules/employees/employees.errors',
    defaultStatusCode: 400,
    category: 'hr',
  },
  EmployeeBusinessError: {
    name: 'EmployeeBusinessError',
    importPath: '../modules/employees/employees.errors',
    defaultStatusCode: 400,
    category: 'hr',
  },
  EmployeeBranchError: {
    name: 'EmployeeBranchError',
    importPath: '../modules/employee_branches/employee_branches.errors',
    defaultStatusCode: 400,
    category: 'hr',
  },
  BranchError: {
    name: 'BranchError',
    importPath: '../modules/branches/branches.errors',
    defaultStatusCode: 400,
    category: 'core',
  },
  CompanyError: {
    name: 'CompanyError',
    importPath: '../modules/companies/companies.errors',
    defaultStatusCode: 400,
    category: 'core',
  },
  ProductError: {
    name: 'ProductError',
    importPath: '../modules/products/products.errors',
    defaultStatusCode: 400,
    category: 'inventory',
  },
  CategoryError: {
    name: 'CategoryError',
    importPath: '../modules/categories/categories.errors',
    defaultStatusCode: 400,
    category: 'inventory',
  },
  SubCategoryError: {
    name: 'SubCategoryError',
    importPath: '../modules/sub-categories/sub-categories.errors',
    defaultStatusCode: 400,
    category: 'inventory',
  },

  // ============ PAYMENT MODULES ============
  PaymentTermError: {
    name: 'PaymentTermError',
    importPath: '../modules/payment-terms/payment-terms.errors',
    defaultStatusCode: 400,
    category: 'payment',
  },
  PaymentMethodError: {
    name: 'PaymentMethodError',
    importPath: '../modules/payment-methods/payment-methods.errors',
    defaultStatusCode: 400,
    category: 'payment',
  },

  // ============ UNIT MODULES ============
  ProductUomError: {
    name: 'ProductUomError',
    importPath: '../modules/product-uoms/product-uoms.errors',
    defaultStatusCode: 400,
    category: 'inventory',
  },
  MetricUnitError: {
    name: 'MetricUnitError',
    importPath: '../modules/metric-units/metric-units.errors',
    defaultStatusCode: 400,
    category: 'inventory',
  },

  // ============ SUPPLIER/PRODUCT MODULES ============
  SupplierProductError: {
    name: 'SupplierProductError',
    importPath: '../modules/supplier-products/supplier-products.errors',
    defaultStatusCode: 400,
    category: 'procurement',
  },
  SupplierError: {
    name: 'SupplierError',
    importPath: '../modules/suppliers/suppliers.errors',
    defaultStatusCode: 400,
    category: 'procurement',
  },

  // ============ BANKING MODULES ============
  BankAccountError: {
    name: 'BankAccountError',
    importPath: '../modules/bank-accounts/bankAccounts.errors',
    defaultStatusCode: 400,
    category: 'banking',
  },
  BankError: {
    name: 'BankError',
    importPath: '../modules/banks/banks.errors',
    defaultStatusCode: 400,
    category: 'banking',
  },

  // ============ JOB MODULE ============
  JobError: {
    name: 'JobError',
    importPath: '../modules/jobs/jobs.errors',
    defaultStatusCode: 400,
    category: 'system',
  },

  // ============ POS IMPORTS ============
  PosImportError: {
    name: 'PosImportError',
    importPath: '../modules/pos-imports/shared/pos-import.errors',
    defaultStatusCode: 400,
    category: 'pos',
  },
  AggregatedTransactionError: {
    name: 'AggregatedTransactionError',
    importPath: '../modules/pos-imports/pos-aggregates/pos-aggregates.errors',
    defaultStatusCode: 400,
    category: 'pos',
  },

  // ============ PERMISSION MODULE ============
  PermissionsError: {
    name: 'PermissionsError',
    importPath: '../modules/permissions/permissions.errors',
    defaultStatusCode: 400,
    category: 'permission',
  },

  // ============ PRICE LIST MODULE ============
  PricelistError: {
    name: 'PricelistError',
    importPath: '../modules/pricelists/pricelists.errors',
    defaultStatusCode: 400,
    category: 'pricing',
  },
  PricelistNotFoundError: {
    name: 'PricelistNotFoundError',
    importPath: '../modules/pricelists/pricelists.errors',
    defaultStatusCode: 404,
    category: 'pricing',
  },

  // ============ USER MODULE ============
  UserError: {
    name: 'UserError',
    importPath: '../modules/users/users.errors',
    defaultStatusCode: 400,
    category: 'user',
  },

  // ============ EXPENSE CATEGORIZATION MODULE ============
  RuleNotFoundError: {
    name: 'RuleNotFoundError',
    importPath: '../modules/expense-categorization/expense-categorization.errors',
    defaultStatusCode: 404,
    category: 'expense_categorization',
  },
  RuleDuplicateError: {
    name: 'RuleDuplicateError',
    importPath: '../modules/expense-categorization/expense-categorization.errors',
    defaultStatusCode: 409,
    category: 'expense_categorization',
  },
  NoEligibleStatementsError: {
    name: 'NoEligibleStatementsError',
    importPath: '../modules/expense-categorization/expense-categorization.errors',
    defaultStatusCode: 422,
    category: 'expense_categorization',
  },
  // ============ MENU BRANCH PRICES MODULE ============
  MenuBranchPriceNotFoundError: {
    name: 'MenuBranchPriceNotFoundError',
    importPath: '../modules/food-production/menu-branch-prices/menu-branch-prices.errors',
    defaultStatusCode: 404,
    category: 'food_production',
  },
  MenuBranchPriceDuplicateError: {
    name: 'MenuBranchPriceDuplicateError',
    importPath: '../modules/food-production/menu-branch-prices/menu-branch-prices.errors',
    defaultStatusCode: 409,
    category: 'food_production',
  },
  MenuBranchPriceSyncError: {
    name: 'MenuBranchPriceSyncError',
    importPath: '../modules/food-production/menu-branch-prices/menu-branch-prices.errors',
    defaultStatusCode: 422,
    category: 'food_production',
  },
  ProductionOrderNotFoundError: {
    name: 'ProductionOrderNotFoundError',
    importPath: '../modules/food-production/production-orders/production-orders.errors',
    defaultStatusCode: 404,
    category: 'food_production',
  },
  ProductionOrderNotDraftError: {
    name: 'ProductionOrderNotDraftError',
    importPath: '../modules/food-production/production-orders/production-orders.errors',
    defaultStatusCode: 422,
    category: 'food_production',
  },
  ProductionOrderNotCompletedError: {
    name: 'ProductionOrderNotCompletedError',
    importPath: '../modules/food-production/production-orders/production-orders.errors',
    defaultStatusCode: 422,
    category: 'food_production',
  },
  ProductionOrderNotVoidableError: {
    name: 'ProductionOrderNotVoidableError',
    importPath: '../modules/food-production/production-orders/production-orders.errors',
    defaultStatusCode: 422,
    category: 'food_production',
  },
  WasteExceedsActualError: {
    name: 'WasteExceedsActualError',
    importPath: '../modules/food-production/production-orders/production-orders.errors',
    defaultStatusCode: 422,
    category: 'food_production',
  },
  FiscalPeriodClosedError: {
    name: 'FiscalPeriodClosedError',
    importPath: '../modules/food-production/production-orders/production-orders.errors',
    defaultStatusCode: 422,
    category: 'food_production',
  },
  COANotFoundError: {
    name: 'COANotFoundError',
    importPath: '../modules/food-production/production-orders/production-orders.errors',
    defaultStatusCode: 422,
    category: 'food_production',
  },
  OrderNumberCollisionError: {
    name: 'OrderNumberCollisionError',
    importPath: '../modules/food-production/production-orders/production-orders.errors',
    defaultStatusCode: 500,
    category: 'food_production',
  },
  DepartmentNotFoundError: {
    name: 'DepartmentNotFoundError',
    importPath: '../modules/departments/departments.errors',
    defaultStatusCode: 404,
    category: 'master_data',
  },
  DepartmentDuplicateError: {
    name: 'DepartmentDuplicateError',
    importPath: '../modules/departments/departments.errors',
    defaultStatusCode: 409,
    category: 'master_data',
  },
  DepartmentInUseError: {
    name: 'DepartmentInUseError',
    importPath: '../modules/departments/departments.errors',
    defaultStatusCode: 422,
    category: 'master_data',
  },
  PositionNotFoundError: {
    name: 'PositionNotFoundError',
    importPath: '../modules/positions/positions.errors',
    defaultStatusCode: 404,
    category: 'master_data',
  },
  PositionDuplicateError: {
    name: 'PositionDuplicateError',
    importPath: '../modules/positions/positions.errors',
    defaultStatusCode: 409,
    category: 'master_data',
  },
  PositionInUseError: {
    name: 'PositionInUseError',
    importPath: '../modules/positions/positions.errors',
    defaultStatusCode: 422,
    category: 'master_data',
  },
  EmployeePositionNotFoundError: {
    name: 'EmployeePositionNotFoundError',
    importPath: '../modules/employee-positions/employee-positions.errors',
    defaultStatusCode: 404,
    category: 'master_data',
  },
  EmployeePositionDuplicateError: {
    name: 'EmployeePositionDuplicateError',
    importPath: '../modules/employee-positions/employee-positions.errors',
    defaultStatusCode: 409,
    category: 'master_data',
  },
  CannotRemoveLastPositionError: {
    name: 'CannotRemoveLastPositionError',
    importPath: '../modules/employee-positions/employee-positions.errors',
    defaultStatusCode: 422,
    category: 'master_data',
  },
  // ============ WAREHOUSE MODULE ============
  WarehouseNotFoundError: {
    name: 'WarehouseNotFoundError',
    importPath: '../modules/warehouses/warehouses.errors',
    defaultStatusCode: 404,
    category: 'inventory',
  },
  WarehouseDuplicateError: {
    name: 'WarehouseDuplicateError',
    importPath: '../modules/warehouses/warehouses.errors',
    defaultStatusCode: 409,
    category: 'inventory',
  },
  WarehouseInUseError: {
    name: 'WarehouseInUseError',
    importPath: '../modules/warehouses/warehouses.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  // ============ STOCK MODULE ============
  StockBalanceNotFoundError: {
    name: 'StockBalanceNotFoundError',
    importPath: '../modules/stock/stock.errors',
    defaultStatusCode: 404,
    category: 'inventory',
  },
  InsufficientStockError: {
    name: 'InsufficientStockError',
    importPath: '../modules/stock/stock.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  DuplicateOpeningBalanceError: {
    name: 'DuplicateOpeningBalanceError',
    importPath: '../modules/stock/stock.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  InvalidMovementError: {
    name: 'InvalidMovementError',
    importPath: '../modules/stock/stock.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  WarehouseAccessDeniedError: {
    name: 'WarehouseAccessDeniedError',
    importPath: '../modules/stock/stock.errors',
    defaultStatusCode: 403,
    category: 'inventory',
  },
  InvalidReferenceError: {
    name: 'InvalidReferenceError',
    importPath: '../modules/stock/stock.errors',
    defaultStatusCode: 400,
    category: 'inventory',
  },
  // ============ PURCHASE REQUEST MODULE ============
  PurchaseRequestNotFoundError: {
    name: 'PurchaseRequestNotFoundError',
    importPath: '../modules/purchase-requests/purchase-requests.errors',
    defaultStatusCode: 404,
    category: 'inventory',
  },
  PurchaseRequestDuplicateError: {
    name: 'PurchaseRequestDuplicateError',
    importPath: '../modules/purchase-requests/purchase-requests.errors',
    defaultStatusCode: 409,
    category: 'inventory',
  },
  PurchaseRequestInvalidStatusError: {
    name: 'PurchaseRequestInvalidStatusError',
    importPath: '../modules/purchase-requests/purchase-requests.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  PurchaseRequestEmptyLinesError: {
    name: 'PurchaseRequestEmptyLinesError',
    importPath: '../modules/purchase-requests/purchase-requests.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  // ============ PURCHASE ORDER MODULE ============
  PurchaseOrderNotFoundError: {
    name: 'PurchaseOrderNotFoundError',
    importPath: '../modules/purchase-orders/purchase-orders.errors',
    defaultStatusCode: 404,
    category: 'inventory',
  },
  PurchaseOrderDuplicateError: {
    name: 'PurchaseOrderDuplicateError',
    importPath: '../modules/purchase-orders/purchase-orders.errors',
    defaultStatusCode: 409,
    category: 'inventory',
  },
  PurchaseOrderInvalidStatusError: {
    name: 'PurchaseOrderInvalidStatusError',
    importPath: '../modules/purchase-orders/purchase-orders.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  PurchaseOrderEmptyLinesError: {
    name: 'PurchaseOrderEmptyLinesError',
    importPath: '../modules/purchase-orders/purchase-orders.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  PurchaseRequestNotApprovedError: {
    name: 'PurchaseRequestNotApprovedError',
    importPath: '../modules/purchase-orders/purchase-orders.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  PurchaseOrderHasReceiptsError: {
    name: 'PurchaseOrderHasReceiptsError',
    importPath: '../modules/purchase-orders/purchase-orders.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  // ============ GOODS RECEIPT MODULE ============
  GoodsReceiptNotFoundError: {
    name: 'GoodsReceiptNotFoundError',
    importPath: '../modules/goods-receipts/goods-receipts.errors',
    defaultStatusCode: 404,
    category: 'inventory',
  },
  GoodsReceiptDuplicateError: {
    name: 'GoodsReceiptDuplicateError',
    importPath: '../modules/goods-receipts/goods-receipts.errors',
    defaultStatusCode: 409,
    category: 'inventory',
  },
  GoodsReceiptAlreadyConfirmedError: {
    name: 'GoodsReceiptAlreadyConfirmedError',
    importPath: '../modules/goods-receipts/goods-receipts.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  GoodsReceiptInvalidPOStatusError: {
    name: 'GoodsReceiptInvalidPOStatusError',
    importPath: '../modules/goods-receipts/goods-receipts.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  GoodsReceiptExceedsOrderedError: {
    name: 'GoodsReceiptExceedsOrderedError',
    importPath: '../modules/goods-receipts/goods-receipts.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  GoodsReceiptInvoiceRequiredError: {
    name: 'GoodsReceiptInvoiceRequiredError',
    importPath: '../modules/goods-receipts/goods-receipts.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  GoodsReceiptAttachmentNotFoundError: {
    name: 'GoodsReceiptAttachmentNotFoundError',
    importPath: '../modules/goods-receipts/goods-receipts.errors',
    defaultStatusCode: 404,
    category: 'inventory',
  },

  // ============ GOODS PROCESSING MODULE ============
  GoodsProcessingNotFoundError: {
    name: 'GoodsProcessingNotFoundError',
    importPath: '../modules/goods-processing/goods-processing.errors',
    defaultStatusCode: 404,
    category: 'inventory',
  },
  GoodsProcessingInvalidStatusError: {
    name: 'GoodsProcessingInvalidStatusError',
    importPath: '../modules/goods-processing/goods-processing.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  GoodsProcessingOutputExceedsInputError: {
    name: 'GoodsProcessingOutputExceedsInputError',
    importPath: '../modules/goods-processing/goods-processing.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  GoodsProcessingPhotoRequiredError: {
    name: 'GoodsProcessingPhotoRequiredError',
    importPath: '../modules/goods-processing/goods-processing.errors',
    defaultStatusCode: 422,
    category: 'inventory',
  },
  GoodsProcessingAlreadyExistsError: {
    name: 'GoodsProcessingAlreadyExistsError',
    importPath: '../modules/goods-processing/goods-processing.errors',
    defaultStatusCode: 409,
    category: 'inventory',
  },
} as const;

export type ErrorRegistryKey = keyof typeof ERROR_REGISTRY;

/**
 * Get all error names from registry
 */
export function getErrorNames(): string[] {
  return Object.values(ERROR_REGISTRY).map((config) => config.name);
}

/**
 * Get error config by name
 */
export function getErrorConfig(name: string): ModuleErrorConfig | undefined {
  return Object.values(ERROR_REGISTRY).find((config) => config.name === name);
}

/**
 * Check if an error name is registered
 */
export function isRegisteredError(name: string): boolean {
  return getErrorConfig(name) !== undefined;
}

