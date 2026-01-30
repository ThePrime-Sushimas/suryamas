import { Pool } from 'pg';
import { BankReconciliationRepository } from './bank-reconciliation.repository';
import { BankReconciliationService } from './bank-reconciliation.service';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { createBankReconciliationRouter } from './bank-reconciliation.routes';

export * from './bank-reconciliation.service';
export * from './bank-reconciliation.controller';
export * from './bank-reconciliation.repository';
export * from './bank-reconciliation.types';
export * from './bank-reconciliation.schema';
export * from './bank-reconciliation.routes';

export function setupBankReconciliationModule(pool: Pool) {
  const repository = new BankReconciliationRepository(pool);
  const service = new BankReconciliationService(repository);
  const controller = new BankReconciliationController(service);
  const router = createBankReconciliationRouter(controller);

  return {
    repository,
    service,
    controller,
    router
  };
}
