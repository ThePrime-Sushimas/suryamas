import { Request, Response } from "express";
import { salesService } from "./pos-sync.service";
import { ImportSalesPayload } from "./pos-sync.types";
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
