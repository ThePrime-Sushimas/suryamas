import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { suppliersService } from './suppliers.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'

export class SuppliersController {
  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.context?.employee_id ? parseInt(req.context.employee_id) : undefined
      const supplier = await suppliersService.createSupplier(req.body, userId)
      sendSuccess(res, supplier, 'Supplier created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await suppliersService.getSuppliers(req.query)
      sendSuccess(res, result.data, 'Suppliers retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  findById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const supplier = await suppliersService.getSupplierById(id)
      sendSuccess(res, supplier, 'Supplier retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const userId = req.context?.employee_id ? parseInt(req.context.employee_id) : undefined
      const supplier = await suppliersService.updateSupplier(id, req.body, userId)
      sendSuccess(res, supplier, 'Supplier updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id)
      const userId = req.context?.employee_id ? parseInt(req.context.employee_id) : undefined
      await suppliersService.deleteSupplier(id, userId)
      sendSuccess(res, null, 'Supplier deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  getOptions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const options = await suppliersService.getSupplierOptions()
      sendSuccess(res, options, 'Supplier options retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const suppliersController = new SuppliersController()