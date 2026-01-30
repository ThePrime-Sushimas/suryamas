/**
 * Bank Reconciliation Module
 * Standard entry point for the module, exporting types, singletons, and setup logic.
 */

export * from "./bank-reconciliation.types";
export * from "./bank-reconciliation.errors";
export * from "./bank-reconciliation.schema";

// Import singletons for use in setup function
import { bankReconciliationRepository } from "./bank-reconciliation.repository";
import { bankReconciliationService } from "./bank-reconciliation.service";
import { bankReconciliationController } from "./bank-reconciliation.controller";
import bankReconciliationRouter from "./bank-reconciliation.routes";

// Re-export singletons for programmatic use
export { bankReconciliationRepository };
export { bankReconciliationService };
export { bankReconciliationController };
export { bankReconciliationRouter };

/**
 * Setup function to initialize the bank reconciliation module.
 * Now simplified to use pre-instantiated singletons for consistency with the project.
 */
export function setupBankReconciliationModule() {
  return {
    repository: bankReconciliationRepository,
    service: bankReconciliationService,
    controller: bankReconciliationController,
    router: bankReconciliationRouter,
  };
}
