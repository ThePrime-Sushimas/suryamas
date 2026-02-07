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

