import { Request, Response } from 'express'
import { handleError } from '../../utils/error-handler.util'
import { salesService, masterService, stagingService, aggregateService } from './pos-sync.service'
import { ImportSalesPayload, ImportMasterPayload, StagingTable, StagingUpdatePayload, StagingStatus } from './pos-sync.types'
import { AuditService } from '../monitoring/monitoring.service'
import { pool } from '../../config/db'

export const salesController = {
  import: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = req.body as ImportSalesPayload
      const result = await salesService.import(payload)
      res.json({ success: true, data: result })
    } catch (err: unknown) {
      await handleError(res, err, req, {
        action: 'pos_import_sales',
        salesCount: req.body?.sales?.length,
        itemsCount: req.body?.items?.length,
      })
    }
  },
}

export const masterController = {
  sync: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = req.body as ImportMasterPayload
      const result = await masterService.sync(payload)
      res.json({ success: true, data: result })
    } catch (err: unknown) {
      await handleError(res, err, req, {
        action: 'pos_sync_master',
        branchesCount: req.body?.branches?.length,
        paymentMethodsCount: req.body?.payment_methods?.length,
      })
    }
  },
}

const VALID_TABLES: StagingTable[] = [
  'branches', 'payment_methods', 'menu_categories', 'menu_groups', 'menus',
]

export const stagingController = {
  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const table = req.params.table as StagingTable
      if (!VALID_TABLES.includes(table)) {
        res.status(400).json({ success: false, message: `Invalid table: ${table}` })
        return
      }

      const VALID_STATUSES = ['pending', 'approved', 'ignored'] as const
      const rawStatus = req.query.status as string | undefined
      const params = {
        status: rawStatus && VALID_STATUSES.includes(rawStatus as typeof VALID_STATUSES[number]) ? rawStatus as StagingStatus : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      }

      const result = await stagingService.list(table, params)
      res.json({ success: true, ...result })
    } catch (err: unknown) {
      await handleError(res, err, req, { action: 'pos_staging_list', table: req.params.table })
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const table = req.params.table as StagingTable
      const posId = Number(req.params.id)

      if (!VALID_TABLES.includes(table)) {
        res.status(400).json({ success: false, message: `Invalid table: ${table}` })
        return
      }
      if (isNaN(posId)) {
        res.status(400).json({ success: false, message: 'Invalid id' })
        return
      }

      const payload = req.body as StagingUpdatePayload
      if (!payload.status || !['pending', 'approved', 'ignored'].includes(payload.status)) {
        res.status(400).json({ success: false, message: 'Invalid status' })
        return
      }

      // Get old data for audit (table already validated by VALID_TABLES check above)
      const tableName = `pos_staging_${table}`
      const { rows: oldRows } = await pool.query(
        `SELECT * FROM ${tableName} WHERE pos_id = $1 LIMIT 1`,
        [posId]
      )
      const oldData = oldRows[0] ?? null

      const data = await stagingService.update(table, posId, payload)

      const userId = req.user?.id ?? null
      await AuditService.log(
        'UPDATE', `pos_staging_${table}`, posId.toString(),
        userId, oldData, data, req.ip, req.get('user-agent')
      )

      res.json({ success: true, data })
    } catch (err: unknown) {
      await handleError(res, err, req, { action: 'pos_staging_update', table: req.params.table, posId: req.params.id })
    }
  },
}

export const aggregateController = {
  recalculateByDate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { sales_date } = req.body
      if (!sales_date) {
        res.status(400).json({ success: false, message: 'sales_date required' })
        return
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sales_date)) {
        res.status(400).json({ success: false, message: 'Format sales_date harus YYYY-MM-DD' })
        return
      }

      const result = await aggregateService.recalculateByDate(sales_date)

      const userId = req.user?.id ?? null
      await AuditService.log(
        'RECALCULATE', 'pos_sync_aggregates', sales_date,
        userId, null, result, req.ip, req.get('user-agent')
      )

      res.json({ success: true, data: result })
    } catch (err: unknown) {
      await handleError(res, err, req, { action: 'pos_recalculate', salesDate: req.body?.sales_date })
    }
  },
}
