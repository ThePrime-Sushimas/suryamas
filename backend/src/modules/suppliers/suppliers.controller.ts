import { Response, Request } from 'express'
import { suppliersService } from './suppliers.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { SupplierType, SupplierListQuery } from './suppliers.types'
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierIdSchema,
  supplierListQuerySchema,
} from './suppliers.schema'

type CreateSupplierReq = ValidatedAuthRequest<typeof createSupplierSchema>
type UpdateSupplierReq = ValidatedAuthRequest<typeof updateSupplierSchema>
type SupplierIdReq = ValidatedAuthRequest<typeof supplierIdSchema>
type SupplierListReq = ValidatedAuthRequest<typeof supplierListQuerySchema>

export class SuppliersController {
  create = withValidated(async (req: CreateSupplierReq, res: Response) => {
    try {
      const { body } = req.validated
      const userId = req.context?.employee_id
      const supplier = await suppliersService.createSupplier({
        ...body,
        supplier_type: body.supplier_type as SupplierType,
      }, userId)
      sendSuccess(res, supplier, 'Supplier created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'create_supplier' })
    }
  })

  list = withValidated(async (req: SupplierListReq, res: Response) => {
    try {
      const { query } = req.validated
      const result = await suppliersService.getSuppliers({
        ...query,
        supplier_type: query.supplier_type as SupplierType | undefined,
      } as SupplierListQuery)
      sendSuccess(res, result.data, 'Suppliers retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'list_suppliers', query: req.validated?.query })
    }
  })

  findById = withValidated(async (req: SupplierIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const supplier = await suppliersService.getSupplierById(params.id)
      sendSuccess(res, supplier, 'Supplier retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'get_supplier', id: req.validated?.params?.id })
    }
  })

  update = withValidated(async (req: UpdateSupplierReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const userId = req.context?.employee_id
      const supplier = await suppliersService.updateSupplier(params.id, {
        ...body,
        supplier_type: body.supplier_type as SupplierType | undefined,
      }, userId)
      sendSuccess(res, supplier, 'Supplier updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'update_supplier', id: req.validated?.params?.id })
    }
  })

  delete = withValidated(async (req: SupplierIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const userId = req.context?.employee_id
      await suppliersService.deleteSupplier(params.id, userId)
      sendSuccess(res, null, 'Supplier deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'delete_supplier', id: req.validated?.params?.id })
    }
  })

  getOptions = async (req: Request, res: Response): Promise<void> => {
    try {
      const options = await suppliersService.getSupplierOptions()
      sendSuccess(res, options, 'Supplier options retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_supplier_options' })
    }
  }

  restore = withValidated(async (req: SupplierIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const userId = req.context?.employee_id
      const supplier = await suppliersService.restoreSupplier(params.id, userId)
      sendSuccess(res, supplier, 'Supplier restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req as unknown as Request, { action: 'restore_supplier', id: req.validated?.params?.id })
    }
  })
}

export const suppliersController = new SuppliersController()
