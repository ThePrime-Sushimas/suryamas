import type { Request, Response } from 'express'
import { warehousesService } from './warehouses.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { createWarehouseSchema, updateWarehouseSchema, warehouseIdSchema, bulkDeleteWarehouseSchema } from './warehouses.schema'
import {
  getBranchReadScope,
  getReadScope,
  getWriteScope,
  requireBranchAccess,
} from '../../utils/branch-access.util'

type CreateReq = ValidatedAuthRequest<typeof createWarehouseSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateWarehouseSchema>
type IdReq = ValidatedAuthRequest<typeof warehouseIdSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof bulkDeleteWarehouseSchema>

export class WarehousesController {
  list = async (req: Request, res: Response) => {
    try {
      const branch_id = req.query.branch_id as string | undefined
      let companyIds: string[]

      const filter: { branch_id?: string; warehouse_type?: string; is_active?: boolean } = {}
      if (branch_id) {
        const { companyIds: ids, branchIds } = await getBranchReadScope(req)
        companyIds = ids
        requireBranchAccess(branch_id, branchIds)
        filter.branch_id = branch_id
      } else {
        ({ companyIds } = await getReadScope(req))
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25
      const warehouse_type = req.query.warehouse_type as string | undefined
      const is_active_raw = req.query.is_active as string | undefined
      const is_active = is_active_raw === 'true' ? true : is_active_raw === 'false' ? false : undefined

      if (warehouse_type) filter.warehouse_type = warehouse_type
      if (is_active !== undefined) filter.is_active = is_active

      const result = await warehousesService.list(companyIds, { page, limit }, undefined, filter)
      sendSuccess(res, result.data, 'Warehouses retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_warehouses' })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25
      const result = await warehousesService.search(companyIds, q, { page, limit })
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_warehouses' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const warehouse = await warehousesService.getById(id, companyIds)
      sendSuccess(res, warehouse, 'Warehouse retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_warehouse', id: req.params.id })
    }
  }

  getByBranch = async (req: Request, res: Response) => {
    try {
      const { companyIds, branchIds } = await getBranchReadScope(req)
      const branchId = req.params.branchId as string
      requireBranchAccess(branchId, branchIds)
      const warehouses = await warehousesService.getByBranch(branchId, companyIds)
      sendSuccess(res, warehouses, 'Branch warehouses retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_warehouses_by_branch', id: req.params.branchId })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { body } = (req as CreateReq).validated
      const warehouse = await warehousesService.create(companyId, body, userId)
      sendSuccess(res, warehouse, 'Warehouse created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_warehouse' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { params, body } = (req as UpdateReq).validated
      const existing = await warehousesService.getById(params.id, companyIds)
      const warehouse = await warehousesService.update(params.id, existing.company_id, body, userId, existing)
      sendSuccess(res, warehouse, 'Warehouse updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_warehouse', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const existing = await warehousesService.getById(id, companyIds)
      await warehousesService.delete(id, existing.company_id, userId, existing)
      sendSuccess(res, null, 'Warehouse deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_warehouse', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const existing = await warehousesService.getById(id, companyIds)
      await warehousesService.restore(id, existing.company_id, userId)
      sendSuccess(res, null, 'Warehouse restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_warehouse', id: req.params.id })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { ids } = (req as BulkDeleteReq).validated.body
      const failed: string[] = []
      let success = 0
      for (const id of ids) {
        try {
          const existing = await warehousesService.getById(id, companyIds)
          await warehousesService.delete(id, existing.company_id, userId, existing)
          success++
        } catch { failed.push(id) }
      }
      sendSuccess(res, { success, failed }, `${success} warehouses deleted`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_warehouses' })
    }
  }
}

export const warehousesController = new WarehousesController()
