import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { productsService } from './products.service'
import { productsExportService } from '../../services/products.export.service'
import { productsImportService } from '../../services/products.import.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'

export class ProductsController {
  list = async (req: AuthRequest & { sort?: any; filterParams?: any; pagination?: any }, res: Response): Promise<void> => {
    try {
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const includeDeleted = req.query.includeDeleted === 'true'
      
      const result = await productsService.list(
        { page, limit },
        req.sort,
        req.filterParams,
        includeDeleted
      )
      
      sendSuccess(res, result.data, 'Products retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  search = async (req: AuthRequest & { sort?: any; filterParams?: any; pagination?: any }, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const includeDeleted = req.query.includeDeleted === 'true'
      
      const result = await productsService.search(
        q,
        { page, limit },
        req.sort,
        req.filterParams,
        includeDeleted
      )
      
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  findById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const includeDeleted = req.query.includeDeleted === 'true'
      const product = await productsService.findById(id, includeDeleted)

      sendSuccess(res, product, 'Product retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const product = await productsService.create(req.body, req.user?.id)
      logInfo('Product created via API', { 
        productId: product.id, 
        userId: req.user?.id
      })
      sendSuccess(res, product, 'Product created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const product = await productsService.update(id, req.body, req.user?.id)
      logInfo('Product updated via API', { 
        productId: id, 
        userId: req.user?.id
      })
      sendSuccess(res, product, 'Product updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await productsService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Product deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  bulkDelete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids } = req.body
      await productsService.bulkDelete(ids, req.user?.id)
      sendSuccess(res, null, 'Products deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  bulkUpdateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids, status } = req.body
      await productsService.bulkUpdateStatus(ids, status, req.user?.id)
      sendSuccess(res, null, 'Status updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  getFilterOptions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const options = await productsService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  minimalActive = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const products = await productsService.minimalActive()
      sendSuccess(res, products, 'Products retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  checkProductName = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { product_name, excludeId } = req.query
      const exists = await productsService.checkProductNameExists(
        product_name as string, 
        excludeId as string
      )
      sendSuccess(res, { exists }, 'Check completed')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const product = await productsService.restore(id, req.user?.id)
      sendSuccess(res, product, 'Product restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  export = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const buffer = await productsExportService.export()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx')
      res.send(buffer)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  importPreview = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' })
        return
      }
      const preview = await productsImportService.preview(req.file.buffer)
      sendSuccess(res, preview, 'Import preview generated')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  import = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' })
        return
      }
      const result = await productsImportService.import(req.file.buffer, req.user?.id)
      sendSuccess(res, result, 'Import completed')
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const productsController = new ProductsController()
