import { Request, Response } from 'express'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { getPaginationParams } from '../../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../../utils/export.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { createChartOfAccountSchema, updateChartOfAccountSchema, bulkUpdateStatusSchema, bulkDeleteSchema, chartOfAccountIdSchema } from './chart-of-accounts.schema'
import { getBranchReadScope, getWriteScope } from '../../../utils/branch-access.util'

async function getAccess(req: Request) {
  return getBranchReadScope(req)
}

async function getWriteCompanyId(req: Request): Promise<string> {
  const { companyId } = await getWriteScope(req)
  return companyId
}

export class ChartOfAccountsController {
  list = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const { offset } = getPaginationParams(req.query)
      const pagination = req.pagination!
      if (pagination.limit > 1000) pagination.limit = 1000
      const result = await chartOfAccountsService.list(branchIds, companyIds, { ...pagination, offset }, req.sort || { field: 'account_code', order: 'asc' as const }, req.filterParams)
      sendSuccess(res, result.data, 'Chart of accounts retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_coa', company_id: req.context?.company_id })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const { offset } = getPaginationParams(req.query)
      const q = req.query.q as string
      const result = await chartOfAccountsService.search(branchIds, companyIds, q, { ...req.pagination!, offset }, req.sort, req.filterParams)
      sendSuccess(res, result.data, 'Chart of accounts retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_coa', company_id: req.context?.company_id })
    }
  }

  getTree = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getAccess(req)
      const requested = req.query.company_id as string | undefined
      const companyId =
        requested && companyIds.includes(requested) ? requested : companyIds[0]
      if (!companyId) throw new Error('No accessible company')
      const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : undefined
      const tree = await chartOfAccountsService.getTree(companyId, maxDepth, req.filterParams)
      sendSuccess(res, tree, 'Chart of accounts tree retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_coa_tree', company_id: req.context?.company_id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      const { body } = (req as ValidatedAuthRequest<typeof createChartOfAccountSchema>).validated
      const account = await chartOfAccountsService.create({ ...body, company_id: companyId }, req.user?.id ?? '')
      sendSuccess(res, account, 'Chart of account created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_coa' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      const { id } = (req as ValidatedAuthRequest<typeof chartOfAccountIdSchema>).validated.params
      const account = await chartOfAccountsService.getById(id, branchIds, companyIds)
      sendSuccess(res, account)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_coa', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      const { params, body } = (req as ValidatedAuthRequest<typeof updateChartOfAccountSchema>).validated
      const account = await chartOfAccountsService.update(params.id, body, req.user?.id ?? '', companyId)
      sendSuccess(res, account, 'Chart of account updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_coa', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      const { id } = (req as ValidatedAuthRequest<typeof chartOfAccountIdSchema>).validated.params
      await chartOfAccountsService.delete(id, req.user?.id ?? '', companyId)
      sendSuccess(res, null, 'Chart of account deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_coa', id: req.params.id })
    }
  }

  getByCodePrefix = async (req: Request, res: Response) => {
    try {
      const { branchIds, companyIds } = await getAccess(req)
      // COA is scoped to a single company; for multi-company users we use the first accessible one.
      // This is intentional — COA prefixes are company-specific and the UI operates in one company context.
      const companyId = companyIds[0]
      if (!companyId) throw new Error('No accessible company')
      const prefix = req.params.prefix as string
      if (!/^\d{1,10}$/.test(prefix)) throw new Error('Invalid prefix format')
      const accounts = await chartOfAccountsService.getByCodePrefix(companyId, prefix)
      sendSuccess(res, accounts)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_coa_by_prefix', prefix: req.params.prefix })
    }
  }

  getFilterOptions = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      const options = await chartOfAccountsService.getFilterOptions(companyId)
      sendSuccess(res, options)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_coa_filter_options' })
    }
  }

  generateExportToken = async (req: Request, res: Response) => {
    return handleExportToken(req, res)
  }

  exportData = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      return handleExport(req, res, (filter) => chartOfAccountsService.exportToExcel(companyId, filter), 'chart-of-accounts')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'export_coa' })
    }
  }

  previewImport = async (req: Request, res: Response) => {
    try {
      return handleImportPreview(req, res, (buffer) => chartOfAccountsService.previewImport(buffer))
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'preview_import_coa' })
    }
  }

  importData = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      return handleImport(req, res, (buffer, skip) => chartOfAccountsService.importFromExcel(buffer, skip, companyId, req.user?.id ?? ''))
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'import_coa' })
    }
  }

  bulkUpdateStatus = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      const { ids, is_active } = (req as ValidatedAuthRequest<typeof bulkUpdateStatusSchema>).validated.body
      if (ids.length > 1000) throw new Error('Cannot update more than 1000 records at once')
      await chartOfAccountsService.bulkUpdateStatus(ids, is_active, req.user?.id ?? '', companyId)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_coa_status' })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      const { ids } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated.body
      if (ids.length > 100) throw new Error('Cannot delete more than 100 records at once')
      await chartOfAccountsService.bulkDelete(ids, req.user?.id ?? '', companyId)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_coa' })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      const { id } = (req as ValidatedAuthRequest<typeof chartOfAccountIdSchema>).validated.params
      await chartOfAccountsService.restore(id, req.user?.id ?? '', companyId)
      sendSuccess(res, null, 'Chart of account restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_coa', id: req.params.id })
    }
  }

  bulkRestore = async (req: Request, res: Response) => {
    try {
      const companyId = await getWriteCompanyId(req)
      const { ids } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated.body
      if (ids.length > 100) throw new Error('Cannot restore more than 100 records at once')
      await chartOfAccountsService.bulkRestore(ids, req.user?.id ?? '', companyId)
      sendSuccess(res, null, 'Bulk restore completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_restore_coa' })
    }
  }
}

export const chartOfAccountsController = new ChartOfAccountsController()
