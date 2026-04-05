import { Request, Response } from "express";
import { salesService, masterService } from "./pos-sync.service";
import { ImportSalesPayload, ImportMasterPayload } from "./pos-sync.types";
import { logWarn } from "../../../config/logger";

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
    } catch (err: any) {
      // ✅ Log full error stack
      console.error("❌ POS import error:", err);
      logWarn("POS import failed", { error: err?.message, stack: err?.stack });

      res.status(500).json({
        success: false,
        message: err?.message || "Internal Server Error",
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
    } catch (err: any) {
      console.error('❌ POS Master sync error:', err)
      logWarn('POS master sync failed', { error: err?.message, stack: err?.stack })

      res.status(500).json({
        success: false,
        message: err?.message || 'Internal Server Error',
      })
    }
  },
};
