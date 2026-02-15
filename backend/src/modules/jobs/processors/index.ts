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
import { processPosTransactionsExport } from './pos-transactions.export'
import { processPosImportsExport } from './pos-imports.export'
import { processPosTransactionsImport } from './pos-transactions.import'
import { processFiscalPeriodsExport } from './fiscal-periods.export'
import { processEmployeesImport } from './employees.import'
import { processPosAggregates } from './pos-aggregates.job-processor'
import { processPosJournals } from './pos-journals.job-processor'
import { processBankStatementImport } from './bank-statement-import.processor'


export interface ProcessorModule<M extends Record<string, any> = Record<string, any>> {
  type: JobType
  module: JobModule
  processor: JobProcessor<M>
}

// Map of (type:module) -> processor
// Key format: "export:products", "import:employees", etc.
// Using any type for processor to handle different metadata structures
export const processorModules: ProcessorModule[] = [
  // Export processors
  { type: 'export', module: 'employees', processor: processEmployeesExport as any },
  { type: 'export', module: 'pos_transactions', processor: processPosTransactionsExport as any },
  { type: 'export', module: 'pos_imports', processor: processPosImportsExport as any },
  { type: 'export', module: 'fiscal_periods', processor: processFiscalPeriodsExport as any },

  // Import processors
  { type: 'import', module: 'employees', processor: processEmployeesImport as any },
  { type: 'import', module: 'pos_transactions', processor: processPosTransactionsImport as any },

  // POS Aggregates processors
  { type: 'import', module: 'pos_aggregates', processor: processPosAggregates as any },

  // POS Journals processors
  { type: 'import', module: 'pos_journals', processor: processPosJournals as any },

  // Bank Statement Import processors
  { type: 'import', module: 'bank_statements', processor: processBankStatementImport as any },
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

