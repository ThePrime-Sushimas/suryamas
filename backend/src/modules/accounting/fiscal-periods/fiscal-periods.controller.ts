import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { fiscalPeriodsService } from './fiscal-periods.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { logInfo } from '../../../config/logger'
import { getPaginationParams } from '../../../utils/pagination.util'
import { handleExportToken, handleExport } from '../../../utils/export.util'
import { FiscalPeriodErrors } from './fiscal-periods.errors'
import { defaultConfig } from './fiscal-periods.config'
import type {
  createFiscalPeriodSchema,
  updateFiscalPeriodSchema,
  closePeriodSchema,
  closePeriodWithEntriesSchema,
  closingPreviewSchema,
  reopenPeriodSchema,
  bulkDeleteSchema,
  bulkRestoreSchema,
} from './fiscal-periods.schema'

export class FiscalPeriodsController {
  private getCompanyId(req: Request): string {
    const companyId = req.context?.company_id
    if (!companyId) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('company_id', 'Branch context required - no company access')
    }
    return companyId
  }

  async list(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const { offset } = getPaginationParams(req.query)

      if (req.pagination!.limit > defaultConfig.limits.pageSize) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('limit', `Page size cannot exceed ${defaultConfig.limits.pageSize}`)
      }

      const result = await fiscalPeriodsService.list(
        companyId, { ...req.pagination!, offset }, req.sort as Parameters<typeof fiscalPeriodsService.list>[2], req.filterParams
      )
      sendSuccess(res, result.data, 'Fiscal periods retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_fiscal_periods' })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof createFiscalPeriodSchema>).validated
      const companyId = this.getCompanyId(req)

      const createData = { ...body, company_id: companyId }
      const period = await fiscalPeriodsService.create(createData, req.user!.id)

      logInfo('Fiscal period created', { period_id: period.id, period: period.period, user: req.user!.id })
      sendSuccess(res, period, 'Fiscal period created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_fiscal_period' })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const period = await fiscalPeriodsService.getById(req.params.id as string, companyId)
      sendSuccess(res, period)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_fiscal_period' })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { body, params } = (req as ValidatedAuthRequest<typeof updateFiscalPeriodSchema>).validated
      const companyId = this.getCompanyId(req)

      const period = await fiscalPeriodsService.update(params.id, body, req.user!.id, companyId)

      logInfo('Fiscal period updated', { period_id: params.id, user: req.user!.id })
      sendSuccess(res, period, 'Fiscal period updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_fiscal_period' })
    }
  }

  async closePeriod(req: Request, res: Response) {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof closePeriodSchema>).validated
      const companyId = this.getCompanyId(req)

      const period = await fiscalPeriodsService.closePeriod(
        params.id, req.user!.id, companyId, body.close_reason || undefined
      )

      logInfo('Fiscal period closed', { period_id: params.id, period: period.period, user: req.user!.id })
      sendSuccess(res, period, 'Fiscal period closed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'close_fiscal_period' })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      if (!req.user?.id) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('user', 'User authentication required')
      }

      await fiscalPeriodsService.delete(req.params.id as string, req.user.id, companyId)

      logInfo('Fiscal period deleted', { period_id: req.params.id, user: req.user.id })
      sendSuccess(res, null, 'Fiscal period deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_fiscal_period' })
    }
  }

  async bulkDelete(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated
      const companyId = this.getCompanyId(req)

      if (body.ids.length > defaultConfig.limits.bulkDelete) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('limit', `Cannot delete more than ${defaultConfig.limits.bulkDelete} records at once`)
      }

      await fiscalPeriodsService.bulkDelete(body.ids, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_fiscal_periods' })
    }
  }

  async restore(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      if (!req.user?.id) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('user', 'User authentication required')
      }

      await fiscalPeriodsService.restore(req.params.id as string, req.user.id, companyId)
      sendSuccess(res, null, 'Fiscal period restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_fiscal_period' })
    }
  }

  async bulkRestore(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkRestoreSchema>).validated
      const companyId = this.getCompanyId(req)

      await fiscalPeriodsService.bulkRestore(body.ids, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk restore completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_restore_fiscal_periods' })
    }
  }

  async generateExportToken(req: Request, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      return handleExport(
        req, res,
        (filter) => fiscalPeriodsService.exportToExcel(companyId, filter),
        'fiscal-periods'
      )
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'export_fiscal_periods' })
    }
  }

  // ============================================================================
  // FISCAL CLOSING HANDLERS
  // ============================================================================

  async getClosingPreview(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const summary = await fiscalPeriodsService.getClosingPreview(req.params.id as string, companyId)
      sendSuccess(res, summary)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_closing_preview', id: req.params.id })
    }
  }

  async closePeriodWithEntries(req: Request, res: Response) {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof closePeriodWithEntriesSchema>).validated
      const companyId = this.getCompanyId(req)

      const result = await fiscalPeriodsService.closePeriodWithEntries(
        params.id, { ...body, close_reason: body.close_reason ?? undefined }, req.user!.id, companyId
      )

      logInfo('Fiscal period closed with entries', {
        period_id: params.id, journal_id: result.closing_journal_id, user: req.user!.id,
      })
      sendSuccess(res, result, 'Fiscal period closed successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'close_period_with_entries', id: req.params.id })
    }
  }

  async reopenPeriod(req: Request, res: Response) {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof reopenPeriodSchema>).validated
      const companyId = this.getCompanyId(req)

      const result = await fiscalPeriodsService.reopenPeriod(
        params.id, { reopen_reason: body.reopen_reason ?? undefined }, req.user!.id, companyId
      )

      logInfo('Fiscal period reopened', {
        period_id: params.id, reversed_journal_id: result.reversed_journal_id, user: req.user!.id,
      })
      sendSuccess(res, result, 'Fiscal period reopened successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reopen_period', id: req.params.id })
    }
  }
}

export const fiscalPeriodsController = new FiscalPeriodsController()
