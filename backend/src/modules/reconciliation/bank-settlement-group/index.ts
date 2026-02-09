/**
 * Settlement Group Module
 * Bulk Settlement Reconciliation (Many Aggregates → 1 Bank Statement)
 */

// Types
export * from "./bank-settlement-group.types";

// Errors
export * from "./bank-settlement-group.errors";

// Routes
import settlementGroupRoutes from "./bank-settlement-group.routes";
export { settlementGroupRoutes };

// Import singletons
import { settlementGroupRepository } from "./bank-settlement-group.repository";
import { settlementGroupService, SettlementGroupService } from "./bank-settlement-group.service";
import { settlementGroupController, SettlementGroupController } from "./bank-settlement-group.controller";

/**
 * Setup function to initialize the settlement group module
 * Uses pre-instantiated singletons for consistency with the project pattern
 */
export function setupSettlementGroupModule() {
  return {
    repository: settlementGroupRepository,
    service: settlementGroupService,
    controller: settlementGroupController,
    router: settlementGroupRoutes,
  };
}

export {
  settlementGroupRepository,
  settlementGroupService,
  settlementGroupController,
  SettlementGroupService,
  SettlementGroupController,
};

