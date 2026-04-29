import { Request, Response } from "express";
import { handleError } from "../../utils/error-handler.util";
import { salesService, masterService, stagingService, aggregateService } from "./pos-sync.service";
import { ImportSalesPayload, ImportMasterPayload, StagingTable, StagingUpdatePayload } from "./pos-sync.types";
import { logWarn } from "../../config/logger";
import { AuditService } from "../monitoring/monitoring.service";
import { pool } from "@/config/db";

export const salesController = {
  import: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = req.body as ImportSalesPayload;
      // ✅ Tambah log size payload
      console.log(`📥 POS Import received:`, {
        sales: payload.sales?.length ?? 0,
        items: payload.items?.length ?? 0,
        payments: payload.payments?.length ?? 0,
      });
      const result = await salesService.import(payload);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      await handleError(res, err, req, { 
        salesCount: req.body?.sales?.length, 
        itemsCount: req.body?.items?.length 
      });
    }
  },
};

export const masterController = {
  sync: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = req.body as ImportMasterPayload

      console.log(`📥 POS Master sync received:`, {
        branches: payload.branches?.length ?? 0,
        payment_methods: payload.payment_methods?.length ?? 0,
        menu_categories: payload.menu_categories?.length ?? 0,
        menu_groups: payload.menu_groups?.length ?? 0,
        menus: payload.menus?.length ?? 0,
      })

      const result = await masterService.sync(payload)

      res.json({
        success: true,
        data: result,
      })
    } catch (err) {
      await handleError(res, err, req, { 
        branchesCount: req.body?.branches?.length, 
        paymentMethodsCount: req.body?.payment_methods?.length 
      })
    }
  },
};

const VALID_TABLES: StagingTable[] = [
  'branches', 'payment_methods', 'menu_categories', 'menu_groups', 'menus'
]

export const stagingController = {
  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const table = req.params.table as StagingTable

      if (!VALID_TABLES.includes(table)) {
        res.status(400).json({ success: false, message: `Invalid table: ${table}` })
        return
      }

      const params = {
        status: req.query.status as any,
        page:  req.query.page  ? Number(req.query.page)  : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      }

      const result = await stagingService.list(table, params)
      res.json({ success: true, ...result })
    } catch (err) {
      await handleError(res, err, req, { table: req.params.table, query: req.query })
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const table  = req.params.table as StagingTable
      const posId  = Number(req.params.id)

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

      // Get OLD data for audit
      const tableName = `pos_staging_${table}`;
      const validTables = ['pos_staging_branches', 'pos_staging_payment_methods', 'pos_staging_menu_categories', 'pos_staging_menu_groups', 'pos_staging_menus'];
      if (!validTables.includes(tableName)) {
        res.status(400).json({ error: 'Invalid table' });
        return;
      }
      const { rows: oldRows } = await pool.query(
        `SELECT * FROM ${tableName} WHERE pos_id = $1 LIMIT 1`,
        [posId]
      );
      const oldData = oldRows[0] ?? null;

      const data = await stagingService.update(table, posId, payload)

      // Audit Log
      const userId = (req as any).user?.id;
      await AuditService.log(
        "UPDATE",
        `pos_staging_${table}`,
        posId.toString(),
        userId,
        oldData,
        data,
        req.ip,
        req.get("user-agent")
      );

      res.json({ success: true, data })
    } catch (err) {
      await handleError(res, err, req, { table: req.params.table, posId: req.params.id })
    }
  },
};

export const aggregateController = {
  recalculateByDate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { sales_date } = req.body;

      if (!sales_date) {
        res.status(400).json({ success: false, message: "sales_date required" });
        return;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(sales_date)) {
        res.status(400).json({ success: false, message: "Format sales_date harus YYYY-MM-DD" });
        return;
      }

      console.log(`🔄 Recalculate triggered for date: ${sales_date}`);
      const result = await aggregateService.recalculateByDate(sales_date);

      // Audit Log
      const userId = (req as any).user?.id;
      await AuditService.log(
        "RECALCULATE",
        "pos_sync_aggregates",
        sales_date,
        userId,
        null,
        result,
        req.ip,
        req.get("user-agent")
      );

      res.json({ success: true, data: result });
    } catch (err) {
      await handleError(res, err, req, { salesDate: req.body?.sales_date });
    }
  },
};

