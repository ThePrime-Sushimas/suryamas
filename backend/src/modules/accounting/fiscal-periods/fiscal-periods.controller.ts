import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { fiscalPeriodsService } from './fiscal-periods.service'
import { closingSnapshotsService } from './closing-snapshots.service'
import { generateSnapshotPdf } from './closing-snapshots-pdf.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { logInfo } from '../../../config/logger'
import { getPaginationParams } from '../../../utils/pagination.util'
import { handleExportToken, handleExport } from '../../../utils/export.util'
import { FiscalPeriodErrors } from './fiscal-periods.errors'
import { defaultConfig } from './fiscal-periods.config'
import { getAccessibleCompanyIds, getWriteScope, requireCompanyAccess } from '../../../utils/branch-access.util'
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
  async list(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const { offset } = getPaginationParams(req.query)

      if (req.pagination!.limit > defaultConfig.limits.pageSize) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('limit', `Page size cannot exceed ${defaultConfig.limits.pageSize}`)
      }

      const filter = { ...req.filterParams }
      if (filter?.company_id) {
        requireCompanyAccess(filter.company_id as string, companyIds)
      }

      const result = await fiscalPeriodsService.list(
        companyIds, { ...req.pagination!, offset }, req.sort as Parameters<typeof fiscalPeriodsService.list>[2], filter
      )
      sendSuccess(res, result.data, 'Fiscal periods retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_fiscal_periods' })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof createFiscalPeriodSchema>).validated
      const { companyId: writeCompanyId, companyIds } = await getWriteScope(req)

      let companyId = writeCompanyId
      if (body.company_id) {
        requireCompanyAccess(body.company_id, companyIds)
        companyId = body.company_id
      }

      const { company_id: _ignored, ...periodFields } = body
      const createData = { ...periodFields, company_id: companyId }
      const period = await fiscalPeriodsService.create(createData, req.user!.id)

      logInfo('Fiscal period created', { period_id: period.id, period: period.period, user: req.user!.id })
      sendSuccess(res, period, 'Fiscal period created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_fiscal_period' })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const period = await fiscalPeriodsService.getById(req.params.id as string, companyIds)
      sendSuccess(res, period)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_fiscal_period' })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { body, params } = (req as ValidatedAuthRequest<typeof updateFiscalPeriodSchema>).validated
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(params.id, companyIds)

      const period = await fiscalPeriodsService.update(params.id, body, req.user!.id, existing.company_id)

      logInfo('Fiscal period updated', { period_id: params.id, user: req.user!.id })
      sendSuccess(res, period, 'Fiscal period updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_fiscal_period' })
    }
  }

  async closePeriod(req: Request, res: Response) {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof closePeriodSchema>).validated
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(params.id, companyIds)

      const period = await fiscalPeriodsService.closePeriod(
        params.id, req.user!.id, existing.company_id, body.close_reason || undefined
      )

      logInfo('Fiscal period closed', { period_id: params.id, period: period.period, user: req.user!.id })
      sendSuccess(res, period, 'Fiscal period closed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'close_fiscal_period' })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      if (!req.user?.id) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('user', 'User authentication required')
      }

      const existing = await fiscalPeriodsService.getById(req.params.id as string, companyIds)
      await fiscalPeriodsService.delete(req.params.id as string, req.user.id, existing.company_id)

      logInfo('Fiscal period deleted', { period_id: req.params.id, user: req.user.id })
      sendSuccess(res, null, 'Fiscal period deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_fiscal_period' })
    }
  }

  async bulkDelete(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')

      if (body.ids.length > defaultConfig.limits.bulkDelete) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('limit', `Cannot delete more than ${defaultConfig.limits.bulkDelete} records at once`)
      }

      await fiscalPeriodsService.bulkDelete(body.ids, req.user!.id, companyIds)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_fiscal_periods' })
    }
  }

  async restore(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      if (!req.user?.id) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('user', 'User authentication required')
      }

      await fiscalPeriodsService.restore(req.params.id as string, req.user.id, companyIds)
      sendSuccess(res, null, 'Fiscal period restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_fiscal_period' })
    }
  }

  async bulkRestore(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkRestoreSchema>).validated
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')

      await fiscalPeriodsService.bulkRestore(body.ids, req.user!.id, companyIds)
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
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      return handleExport(
        req, res,
        (filter) => fiscalPeriodsService.exportToExcel(companyIds, filter),
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
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(req.params.id as string, companyIds)
      const summary = await fiscalPeriodsService.getClosingPreview(req.params.id as string, existing.company_id)
      sendSuccess(res, summary)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_closing_preview', id: req.params.id })
    }
  }

  async closePeriodWithEntries(req: Request, res: Response) {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof closePeriodWithEntriesSchema>).validated
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(params.id, companyIds)

      const result = await fiscalPeriodsService.closePeriodWithEntries(
        params.id, { ...body, close_reason: body.close_reason ?? undefined }, req.user!.id, existing.company_id
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
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(params.id, companyIds)

      const result = await fiscalPeriodsService.reopenPeriod(
        params.id, { reopen_reason: body.reopen_reason ?? undefined }, req.user!.id, existing.company_id
      )

      logInfo('Fiscal period reopened', {
        period_id: params.id, reversed_journal_id: result.reversed_journal_id, user: req.user!.id,
      })
      sendSuccess(res, result, 'Fiscal period reopened successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reopen_period', id: req.params.id })
    }
  }

  // ─── Closing Snapshots ─────────────────────────────────────────────────────

  async listSnapshots(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(req.params.id as string, companyIds)
      const snapshots = await closingSnapshotsService.listVersions(existing.id, existing.company_id)
      sendSuccess(res, snapshots, 'Closing snapshots retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_closing_snapshots', id: req.params.id })
    }
  }

  async getSnapshotByVersion(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(req.params.id as string, companyIds)
      const version = parseInt(req.params.version as string, 10)
      if (isNaN(version) || version < 1) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('version', 'Version harus berupa angka positif')
      }
      const snapshot = await closingSnapshotsService.getByVersion(existing.id, version, existing.company_id)
      if (!snapshot) {
        throw FiscalPeriodErrors.NOT_FOUND(`snapshot version ${version}`)
      }
      sendSuccess(res, snapshot, 'Closing snapshot retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_closing_snapshot', id: req.params.id, version: req.params.version })
    }
  }

  async getLatestSnapshot(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(req.params.id as string, companyIds)
      const snapshot = await closingSnapshotsService.getLatest(existing.id, existing.company_id)
      if (!snapshot) {
        throw FiscalPeriodErrors.NOT_FOUND('snapshot for this period')
      }
      sendSuccess(res, snapshot, 'Latest closing snapshot retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_latest_closing_snapshot', id: req.params.id })
    }
  }

  async retrySnapshot(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(req.params.id as string, companyIds)
      await fiscalPeriodsService.retrySnapshot(existing.id, req.user!.id, existing.company_id)
      sendSuccess(res, null, 'Snapshot berhasil dibuat')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'retry_snapshot', id: req.params.id })
    }
  }

  async downloadSnapshotPdf(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const existing = await fiscalPeriodsService.getById(req.params.id as string, companyIds)
      const version = parseInt(req.params.version as string, 10)
      if (isNaN(version) || version < 1) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('version', 'Version harus berupa angka positif')
      }
      const snapshot = await closingSnapshotsService.getByVersion(existing.id, version, existing.company_id)
      if (!snapshot) {
        throw FiscalPeriodErrors.NOT_FOUND(`snapshot version ${version}`)
      }

      // Resolve company name
      const { pool } = await import('../../../config/db')
      const { rows: companyRows } = await pool.query(
        `SELECT company_name FROM companies WHERE id = $1`, [existing.company_id]
      )
      const companyName = companyRows[0]?.company_name ?? 'Company'

      const pdfBuffer = await generateSnapshotPdf({
        header: snapshot.header,
        companyName,
        periodLabel: existing.period,
        trialBalance: snapshot.trial_balance,
        incomeStatement: snapshot.income_statement,
        balanceSheet: snapshot.balance_sheet,
      })

      const filename = `closing-snapshot_${existing.period}_v${version}.pdf`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Length', pdfBuffer.length)
      res.end(pdfBuffer)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'download_snapshot_pdf', id: req.params.id, version: req.params.version })
    }
  }
}

export const fiscalPeriodsController = new FiscalPeriodsController()
