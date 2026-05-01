import { Request, Response } from 'express'
import { suppliersService } from './suppliers.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { SupplierType, SupplierListQuery } from './suppliers.types'
import {
  createSupplierSchema, updateSupplierSchema, supplierIdSchema, supplierListQuerySchema,
} from './suppliers.schema'

type CreateReq = ValidatedAuthRequest<typeof createSupplierSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateSupplierSchema>
type IdReq = ValidatedAuthRequest<typeof supplierIdSchema>
type ListReq = ValidatedAuthRequest<typeof supplierListQuerySchema>

export class SuppliersController {
  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const supplier = await suppliersService.createSupplier({
        ...body,
        supplier_type: body.supplier_type as SupplierType,
      }, req.context?.employee_id)
      sendSuccess(res, supplier, 'Supplier created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_supplier' })
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const { query } = (req as ListReq).validated
      const result = await suppliersService.getSuppliers({
        ...query,
        supplier_type: query.supplier_type as SupplierType | undefined,
      } as SupplierListQuery)
      sendSuccess(res, result.data, 'Suppliers retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_suppliers' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const supplier = await suppliersService.getSupplierById(id)
      sendSuccess(res, supplier, 'Supplier retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_supplier', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const supplier = await suppliersService.updateSupplier(params.id, {
        ...body,
        supplier_type: body.supplier_type as SupplierType | undefined,
      }, req.context?.employee_id)
      sendSuccess(res, supplier, 'Supplier updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_supplier', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await suppliersService.deleteSupplier(id, req.context?.employee_id)
      sendSuccess(res, null, 'Supplier deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_supplier', id: req.params.id })
    }
  }

  getOptions = async (req: Request, res: Response) => {
    try {
      const options = await suppliersService.getSupplierOptions()
      sendSuccess(res, options, 'Supplier options retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_supplier_options' })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const supplier = await suppliersService.restoreSupplier(id, req.context?.employee_id)
      sendSuccess(res, supplier, 'Supplier restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_supplier', id: req.params.id })
    }
  }
}

export const suppliersController = new SuppliersController()
