import { Request, Response } from 'express'
import { productsService } from './products.service'
import { productsExportService } from '../../services/products.export.service'
import { productsImportService } from '../../services/products.import.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo, logError } from '../../config/logger'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { ProductType, ProductStatus } from './products.types'
import { jobsService, jobsRepository } from '../jobs'
import {
  createProductSchema,
  updateProductSchema,
  bulkDeleteSchema,
  bulkUpdateStatusSchema,
  bulkRestoreSchema,
  productIdSchema,
  checkProductNameSchema,
} from './products.schema'

export class ProductsController {
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const includeDeleted = req.query.includeDeleted === 'true'
      const result = await productsService.list({ page, limit }, req.sort, req.filterParams, includeDeleted)
      sendSuccess(res, result.data, 'Products retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list' })
    }
  }

  search = async (req: Request, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const includeDeleted = req.query.includeDeleted === 'true'
      const result = await productsService.search(q, { page, limit }, req.sort, req.filterParams, includeDeleted)
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search', query: req.query.q })
    }
  }

  findById = async (req: ValidatedAuthRequest<typeof productIdSchema>, res: Response): Promise<void> => {
    try {
      const { params } = req.validated
      const includeDeleted = req.query.includeDeleted === 'true'
      const product = await productsService.findById(params.id, includeDeleted)
      sendSuccess(res, product, 'Product retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'findById', id: req.validated?.params?.id })
    }
  }

  create = async (req: ValidatedAuthRequest<typeof createProductSchema>, res: Response): Promise<void> => {
    try {
      const body = req.validated.body
      const product = await productsService.create({
        ...body,
        product_type: body.product_type as ProductType | undefined,
        status: body.status as ProductStatus | undefined,
      }, req.user?.id)
      logInfo('Product created via API', { productId: product.id, userId: req.user?.id })
      sendSuccess(res, product, 'Product created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create' })
    }
  }

  update = async (req: ValidatedAuthRequest<typeof updateProductSchema>, res: Response): Promise<void> => {
    try {
      const { params, body } = req.validated
      const product = await productsService.update(params.id, {
        ...body,
        product_type: body.product_type as ProductType | undefined,
        status: body.status as ProductStatus | undefined,
      }, req.user?.id)
      logInfo('Product updated via API', { productId: params.id, userId: req.user?.id })
      sendSuccess(res, product, 'Product updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update', id: req.validated?.params?.id })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string
      await productsService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Product deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete', id: req.params.id })
    }
  }

  bulkDelete = async (req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response): Promise<void> => {
    try {
      const { ids } = req.validated.body
      await productsService.bulkDelete(ids, req.user?.id)
      sendSuccess(res, null, 'Products deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulkDelete' })
    }
  }

  bulkUpdateStatus = async (req: ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res: Response): Promise<void> => {
    try {
      const { ids, status } = req.validated.body
      await productsService.bulkUpdateStatus(ids, status as ProductStatus, req.user?.id)
      sendSuccess(res, null, 'Status updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulkUpdateStatus' })
    }
  }

  getFilterOptions = async (req: Request, res: Response): Promise<void> => {
    try {
      const options = await productsService.getFilterOptions()
      sendSuccess(res, options, 'Filter options retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'getFilterOptions' })
    }
  }

  minimalActive = async (req: Request, res: Response): Promise<void> => {
    try {
      const products = await productsService.minimalActive()
      sendSuccess(res, products, 'Products retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'minimalActive' })
    }
  }

  checkProductName = async (req: ValidatedAuthRequest<typeof checkProductNameSchema>, res: Response): Promise<void> => {
    try {
      const { product_name, excludeId } = req.validated.query
      const exists = await productsService.checkProductNameExists(product_name, excludeId)
      sendSuccess(res, { exists }, 'Check completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'checkProductName' })
    }
  }

  restore = async (req: ValidatedAuthRequest<typeof productIdSchema>, res: Response): Promise<void> => {
    try {
      const { params } = req.validated
      const product = await productsService.restore(params.id, req.user?.id)
      sendSuccess(res, product, 'Product restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore', id: req.validated?.params?.id })
    }
  }

  bulkRestore = async (req: ValidatedAuthRequest<typeof bulkRestoreSchema>, res: Response): Promise<void> => {
    try {
      const { ids } = req.validated.body
      await productsService.bulkRestore(ids, req.user?.id)
      sendSuccess(res, null, 'Products restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulkRestore' })
    }
  }

  export = async (req: Request, res: Response): Promise<void> => {
    try {
      const buffer = await productsExportService.export()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx')
      res.send(buffer)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'export' })
    }
  }

  createExportJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id
      if (!companyId) return sendError(res, 'Company context required', 400)

      const hasActiveJob = await jobsRepository.hasActiveJob(userId)
      if (hasActiveJob) return sendError(res, 'You already have an active job. Please wait for it to complete.', 429)

      const filter: Record<string, unknown> = {}
      if (req.query.status) filter.status = req.query.status
      if (req.query.category_id) filter.category_id = req.query.category_id
      if (req.query.search) filter.search = req.query.search

      const job = await jobsService.createJob({
        user_id: userId, company_id: companyId, type: 'export', module: 'products',
        name: `Export Products - ${new Date().toISOString().slice(0, 10)}`,
        metadata: { type: 'export', module: 'products', filter: Object.keys(filter).length > 0 ? filter : undefined }
      })

      logInfo('Products export job created', { job_id: job.id, user_id: userId })

      const { jobWorker } = await import('../jobs/jobs.worker')
      jobWorker.processJob(job.id).catch(err => {
        logError('Products export job processing error', { job_id: job.id, error: err })
      })

      sendSuccess(res, {
        job_id: job.id, status: job.status, name: job.name, type: job.type, module: job.module,
        created_at: job.created_at, message: 'Export job created successfully. Processing in background.'
      }, 'Export job created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'createExportJob' })
    }
  }

  importPreview = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) return sendError(res, 'No file uploaded', 400)
      const preview = await productsImportService.preview(req.file.buffer)
      sendSuccess(res, preview, 'Import preview generated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'importPreview' })
    }
  }

  import = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) return sendError(res, 'No file uploaded', 400)
      const result = await productsImportService.import(req.file.buffer, req.user?.id)
      sendSuccess(res, result, 'Import completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'import' })
    }
  }

  createImportJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id
      if (!companyId) return sendError(res, 'Company context required', 400)

      if (!req.file) return sendError(res, 'No file uploaded', 400)

      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel', 'application/octet-stream'
      ]
      if (!allowedMimeTypes.includes(req.file.mimetype)) return sendError(res, 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed', 400)

      const maxSize = 10 * 1024 * 1024
      if (req.file.size > maxSize) return sendError(res, `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`, 400)

      const hasActiveJob = await jobsRepository.hasActiveJob(userId)
      if (hasActiveJob) return sendError(res, 'You already have an active job. Please wait for it to complete.', 429)

      const { saveTempFile } = await import('../jobs/jobs.util')
      const filePath = await saveTempFile(req.file.buffer, `products_import_${Date.now()}.xlsx`)
      const skipDuplicates = req.body.skipDuplicates === 'true' || req.body.skipDuplicates === true

      const job = await jobsService.createJob({
        user_id: userId, company_id: companyId, type: 'import', module: 'products',
        name: `Import Products - ${req.file.originalname}`,
        metadata: { type: 'import', module: 'products', filePath, fileName: req.file.originalname, fileSize: req.file.size, skipDuplicates, mimeType: req.file.mimetype }
      })

      logInfo('Products import job created', { job_id: job.id, file_name: req.file.originalname, file_size: req.file.size, user_id: userId })

      const { jobWorker } = await import('../jobs/jobs.worker')
      jobWorker.processJob(job.id).catch(err => {
        logError('Products import job processing error', { job_id: job.id, error: err })
      })

      sendSuccess(res, {
        job_id: job.id, status: job.status, name: job.name, type: job.type, module: job.module,
        created_at: job.created_at, file_name: req.file.originalname, file_size: req.file.size,
        message: 'Import job created successfully. Processing in background.'
      }, 'Import job created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'createImportJob' })
    }
  }
}

export const productsController = new ProductsController()
