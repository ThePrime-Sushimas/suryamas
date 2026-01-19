/**
 * Job Processors Index
 * Export all job processors for registration
 * 
 * Design: Register processors by (type, module) combination
 * This allows extensibility without DB schema changes
 */

import { JobProcessor } from '../jobs.worker'
import { JobType, JobModule } from '../jobs.types'
import { processEmployeesExport } from './employees.export'
import { processCompaniesExport } from './companies.export'
import { processProductsExport } from './products.export'
import { processProductsImport } from './products.import'
import { processPosTransactionsExport } from './pos-transactions.export'
import { processPosTransactionsImport } from './pos-transactions.import'
import { processFiscalPeriodsExport } from './fiscal-periods.export'
import { processChartOfAccountsExport } from './chart-of-accounts.export'
import { processAccountingPurposesExport } from './accounting-purposes.export'
import { processPaymentMethodsExport } from './payment-methods.export'
import { processCategoriesExport } from './categories.export'
import { processSubCategoriesExport } from './sub-categories.export'
import { processEmployeesImport } from './employees.import'
import { processCompaniesImport } from './companies.import'
import { processChartOfAccountsImport } from './chart-of-accounts.import'
import { processAccountingPurposesImport } from './accounting-purposes.import'

export interface ProcessorModule {
  type: JobType
  module: JobModule
  processor: JobProcessor
}

// Map of (type:module) -> processor
// Key format: "export:products", "import:employees", etc.
export const processorModules: ProcessorModule[] = [
  // Export processors
  { type: 'export', module: 'employees', processor: processEmployeesExport as JobProcessor },
  { type: 'export', module: 'companies', processor: processCompaniesExport as JobProcessor },
  { type: 'export', module: 'products', processor: processProductsExport as JobProcessor },
  { type: 'export', module: 'pos_transactions', processor: processPosTransactionsExport as JobProcessor },
  { type: 'export', module: 'fiscal_periods', processor: processFiscalPeriodsExport as JobProcessor },
  { type: 'export', module: 'chart_of_accounts', processor: processChartOfAccountsExport as JobProcessor },
  { type: 'export', module: 'accounting_purposes', processor: processAccountingPurposesExport as JobProcessor },
  { type: 'export', module: 'accounting_purpose_accounts', processor: processAccountingPurposesExport as JobProcessor }, // Reuse
  { type: 'export', module: 'payment_methods', processor: processPaymentMethodsExport as JobProcessor },
  { type: 'export', module: 'categories', processor: processCategoriesExport as JobProcessor },
  { type: 'export', module: 'sub_categories', processor: processSubCategoriesExport as JobProcessor },

  // Import processors
  { type: 'import', module: 'products', processor: processProductsImport as JobProcessor },
  { type: 'import', module: 'employees', processor: processEmployeesImport as JobProcessor },
  { type: 'import', module: 'companies', processor: processCompaniesImport as JobProcessor },
  { type: 'import', module: 'chart_of_accounts', processor: processChartOfAccountsImport as JobProcessor },
  { type: 'import', module: 'accounting_purposes', processor: processAccountingPurposesImport as JobProcessor },
  { type: 'import', module: 'pos_transactions', processor: processPosTransactionsImport as JobProcessor },
]

/**
 * Get processor key for a job
 * @param type - 'export' or 'import'
 * @param module - The module name (e.g., 'products', 'employees')
 * @returns Key string in format "type:module"
 */
export function getProcessorKey(type: JobType, module: JobModule): string {
  return `${type}:${module}`
}

/**
 * Register all processors with the worker
 * @param registerFn - Function to register a processor (key -> processor)
 */
export function registerAllProcessors(
  registerFn: (key: string, processor: JobProcessor) => void
): void {
  for (const module of processorModules) {
    const key = getProcessorKey(module.type, module.module)
    registerFn(key, module.processor)
  }
}

/**
 * Get all available modules for a given job type
 * @param type - Job type ('export' or 'import')
 * @returns Array of available modules
 */
export function getAvailableModules(type: JobType): JobModule[] {
  return processorModules
    .filter(m => m.type === type)
    .map(m => m.module)
}

