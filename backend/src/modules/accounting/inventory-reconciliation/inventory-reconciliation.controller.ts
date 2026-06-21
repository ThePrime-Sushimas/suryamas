import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { inventoryReconciliationService } from './inventory-reconciliation.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { inventoryReconciliationQuerySchema } from './inventory-reconciliation.schema'
import { getAccessibleBranchIds, getAccessibleCompanyIds, requireBranchAccess } from '../../../utils/branch-access.util'

export class InventoryReconciliationController {
  async get(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const [companyIds, accessibleBranchIds] = await Promise.all([
        getAccessibleCompanyIds(userId),
        getAccessibleBranchIds(userId),
      ])

      const { query } = (req as ValidatedAuthRequest<typeof inventoryReconciliationQuerySchema>).validated
      const { as_of_date, branch_ids } = query

      let branchFilterIds: string[]
      if (branch_ids) {
        branchFilterIds = branch_ids.split(',').map(s => s.trim()).filter(Boolean)
        for (const id of branchFilterIds) requireBranchAccess(id, accessibleBranchIds)
      } else {
        branchFilterIds = accessibleBranchIds
      }

      const result = await inventoryReconciliationService.getReconciliation({
        companyIds,
        branchIds: branchFilterIds,
        asOfDate: as_of_date,
      })

      sendSuccess(res, result, 'Inventory reconciliation retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_inventory_reconciliation' })
    }
  }
}

export const inventoryReconciliationController = new InventoryReconciliationController()
