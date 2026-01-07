import { Response, Request } from 'express'
import { suppliersService } from './suppliers.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import { AuthRequest } from '../../types/common.types'
import type { ValidatedRequest } from '../../middleware/validation.middleware'
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierIdSchema,
  supplierListQuerySchema,
} from './suppliers.schema'

type CreateSupplierReq = ValidatedRequest<typeof createSupplierSchema>
type UpdateSupplierReq = ValidatedRequest<typeof updateSupplierSchema>
type SupplierIdReq = ValidatedRequest<typeof supplierIdSchema>
type SupplierListReq = ValidatedRequest<typeof supplierListQuerySchema>

export class SuppliersController {
  create = withValidated(async (req: CreateSupplierReq, res: Response) => {
    try {
      const { body } = req.validated
      const userId = req.context?.employee_id ? parseInt(req.context.employee_id) : undefined
      const supplier = await suppliersService.createSupplier(body, userId)
      sendSuccess(res, supplier, 'Supplier created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  list = withValidated(async (req: SupplierListReq, res: Response) => {
    try {
      const { query } = req.validated
      const result = await suppliersService.getSuppliers(query)
      sendSuccess(res, result.data, 'Suppliers retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  findById = withValidated(async (req: SupplierIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const id = parseInt(params.id)
      const supplier = await suppliersService.getSupplierById(id)
      sendSuccess(res, supplier, 'Supplier retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdateSupplierReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const id = parseInt(params.id)
      const userId = req.context?.employee_id ? parseInt(req.context.employee_id) : undefined
      const supplier = await suppliersService.updateSupplier(id, body, userId)
      sendSuccess(res, supplier, 'Supplier updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = withValidated(async (req: SupplierIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const id = parseInt(params.id)
      const userId = req.context?.employee_id ? parseInt(req.context.employee_id) : undefined
      await suppliersService.deleteSupplier(id, userId)
      sendSuccess(res, null, 'Supplier deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  getOptions = async (req: Request, res: Response): Promise<void> => {
    try {
      const options = await suppliersService.getSupplierOptions()
      sendSuccess(res, options, 'Supplier options retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const suppliersController = new SuppliersController()
