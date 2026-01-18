import { Response, Request } from 'express'
import { productsService } from './products.service'
import { productsExportService } from '../../services/products.export.service'
import { productsImportService } from '../../services/products.import.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo, logError } from '../../config/logger'
import { withValidated } from '../../utils/handler'
import type { AuthenticatedQueryRequest } from '../../types/request.types'
import type { ValidatedRequest } from '../../middleware/validation.middleware'
import type { ProductType, ProductStatus } from './products.types'
import { jobsService, jobsRepository } from '../jobs'
import {
  createProductSchema,
  updateProductSchema,
  bulkDeleteSchema,
  bulkUpdateStatusSchema,
  bulkRestoreSchema,
  productIdSchema,
} from './products.schema'

type CreateProductReq = ValidatedRequest<typeof createProductSchema>
type UpdateProductReq = ValidatedRequest<typeof updateProductSchema>
type BulkDeleteReq = ValidatedRequest<typeof bulkDeleteSchema>
type BulkUpdateStatusReq = ValidatedRequest<typeof bulkUpdateStatusSchema>
type BulkRestoreReq = ValidatedRequest<typeof bulkRestoreSchema>
type ProductIdReq = ValidatedRequest<typeof productIdSchema>

export class ProductsController {
  // ============================================
  // LIST & SEARCH
  // ============================================

  list = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
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

  search = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
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

  findById = withValidated(async (req: ProductIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const includeDeleted = req.query.includeDeleted === 'true'
      const product = await productsService.findById(params.id, includeDeleted)
      sendSuccess(res, product, 'Product retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  create = withValidated(async (req: CreateProductReq, res: Response) => {
    try {
      const body = req.validated.body as any
      const product = await productsService.create({
        ...body,
        product_type: body.product_type as ProductType | undefined,
      }, (req as any).user?.id)
      logInfo('Product created via API', { 
        productId: product.id, 
        userId: (req as any).user?.id
      })
      sendSuccess(res, product, 'Product created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdateProductReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const bodyData = body as any
      const product = await productsService.update(params.id, {
        ...bodyData,
        product_type: bodyData.product_type as ProductType | undefined,
      }, (req as any).user?.id)
      logInfo('Product updated via API', { 
        productId: params.id, 
        userId: (req as any).user?.id
      })
      sendSuccess(res, product, 'Product updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await productsService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Product deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  bulkDelete = withValidated(async (req: BulkDeleteReq, res: Response) => {
    try {
      const { ids } = req.validated.body
      await productsService.bulkDelete(ids, (req as any).user?.id)
      sendSuccess(res, null, 'Products deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  bulkUpdateStatus = withValidated(async (req: BulkUpdateStatusReq, res: Response) => {
    try {
      const { ids, status } = req.validated.body
      await productsService.bulkUpdateStatus(ids, status as ProductStatus, (req as any).user?.id)
      sendSuccess(res, null, 'Status updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  getFilterOptions = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const options = await productsService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  minimalActive = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const products = await productsService.minimalActive()
      sendSuccess(res, products, 'Products retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  checkProductName = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
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

  restore = withValidated(async (req: ProductIdReq, res: Response) => {
    try {
      const { params } = req.validated
      const product = await productsService.restore(params.id, (req as any).user?.id)
      sendSuccess(res, product, 'Product restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  bulkRestore = withValidated(async (req: BulkRestoreReq, res: Response) => {
    try {
      const { ids } = req.validated.body
      await productsService.bulkRestore(ids, (req as any).user?.id)
      sendSuccess(res, null, 'Products restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  // ============================================
  // EXPORT OPERATIONS (Direct - Legacy)
  // ============================================

  export = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const buffer = await productsExportService.export()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx')
      res.send(buffer)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  // ============================================
  // EXPORT OPERATIONS (JOB-BASED - New)
  // ============================================

  /**
   * Create export job for products
   * POST /api/v1/products/export/job
   * 
   * Creates a job and immediately returns job ID.
   * Processing happens in background via job worker.
   */
  createExportJob = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return sendError(res, 'Company context required', 400)
      }

      // Check for existing active job
      const hasActiveJob = await jobsRepository.hasActiveJob(userId)
      if (hasActiveJob) {
        return sendError(res, 'You already have an active job. Please wait for it to complete.', 429)
      }

      // Extract filter from query params
      const filter: Record<string, unknown> = {}
      if (req.query.status) filter.status = req.query.status
      if (req.query.category_id) filter.category_id = req.query.category_id
      if (req.query.search) filter.search = req.query.search

      // Create the export job
      const job = await jobsService.createJob({
        user_id: userId,
        company_id: companyId,
        type: 'export',
        module: 'products',
        name: `Export Products - ${new Date().toISOString().slice(0, 10)}`,
        metadata: {
          type: 'export',
          module: 'products',
          filter: Object.keys(filter).length > 0 ? filter : undefined
        }
      })

      logInfo('Products export job created', { job_id: job.id, user_id: userId })

      // Trigger background processing (don't await)
      const { jobWorker } = await import('../jobs/jobs.worker')
      jobWorker.processJob(job.id).catch(error => {
        logError('Products export job processing error', { job_id: job.id, error })
      })

      sendSuccess(res, {
        job_id: job.id,
        status: job.status,
        name: job.name,
        type: job.type,
        module: job.module,
        created_at: job.created_at,
        message: 'Export job created successfully. Processing in background.'
      }, 'Export job created', 201)
    } catch (error: any) {
      logError('Failed to create export job', { error: error.message })
      handleError(res, error)
    }
  }

  // ============================================
  // IMPORT OPERATIONS (Direct - Legacy)
  // ============================================

  importPreview = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
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

  import = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
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

  // ============================================
  // IMPORT OPERATIONS (JOB-BASED - New)
  // ============================================

  /**
   * Create import job for products
   * POST /api/v1/products/import/job
   * 
   * Accepts file upload, creates a job, and returns job ID.
   * Processing happens in background via job worker.
   */
  createImportJob = async (req: AuthenticatedQueryRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return sendError(res, 'Company context required', 400)
      }

      if (!req.file) {
        return sendError(res, 'No file uploaded', 400)
      }

      // Check file type
      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
      ]
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return sendError(res, 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed', 400)
      }

      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024
      if (req.file.size > maxSize) {
        return sendError(res, `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`, 400)
      }

      // Check for existing active job
      const hasActiveJob = await jobsRepository.hasActiveJob(userId)
      if (hasActiveJob) {
        return sendError(res, 'You already have an active job. Please wait for it to complete.', 429)
      }

      // Save file to temp location
      const { saveTempFile } = await import('../jobs/jobs.util')
      const filePath = await saveTempFile(req.file.buffer, `products_import_${Date.now()}.xlsx`)

      // Parse skipDuplicates from body
      const skipDuplicates = req.body.skipDuplicates === 'true' || req.body.skipDuplicates === true

      // Create the import job
      const job = await jobsService.createJob({
        user_id: userId,
        company_id: companyId,
        type: 'import',
        module: 'products',
        name: `Import Products - ${req.file.originalname}`,
        metadata: {
          type: 'import',
          module: 'products',
          filePath,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          skipDuplicates,
          mimeType: req.file.mimetype
        }
      })

      logInfo('Products import job created', { 
        job_id: job.id, 
        file_name: req.file.originalname,
        file_size: req.file.size,
        user_id: userId 
      })

      // Trigger background processing (don't await)
      const { jobWorker } = await import('../jobs/jobs.worker')
      jobWorker.processJob(job.id).catch(error => {
        logError('Products import job processing error', { job_id: job.id, error })
      })

      sendSuccess(res, {
        job_id: job.id,
        status: job.status,
        name: job.name,
        type: job.type,
        module: job.module,
        created_at: job.created_at,
        file_name: req.file.originalname,
        file_size: req.file.size,
        message: 'Import job created successfully. Processing in background.'
      }, 'Import job created', 201)
    } catch (error: any) {
      logError('Failed to create import job', { error: error.message })
      handleError(res, error)
    }
  }
}

export const productsController = new ProductsController()

