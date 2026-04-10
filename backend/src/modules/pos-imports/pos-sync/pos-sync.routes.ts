import { Router } from "express";
import { requireApiKey } from "../../../middleware/api-key.middleware";
import { authenticate } from "../../../middleware/auth.middleware";
import { canView, canUpdate, canInsert } from "../../../middleware/permission.middleware";
import { PermissionService } from "../../../services/permission.service";
import {
  salesController,
  masterController,
  stagingController,
  aggregateController,
} from "./pos-sync.controller";
import { processPosSyncAggregates } from "@/modules/jobs/processors/pos-sync-aggregates.processor";
import { logError } from "../../../config/logger";

const router = Router();

// Register module permissions
PermissionService.registerModule('pos_imports', 'POS Imports & Staging Management').catch((error) => {
  console.error('Failed to register pos_imports module:', error.message)
})


router.post("/import", requireApiKey, salesController.import);
router.post("/master", requireApiKey, masterController.sync);

// Staging routes protected by pos_imports module permissions
router.get("/staging/:table", authenticate, canView('pos_imports'), stagingController.list);
router.patch("/staging/:table/:id", authenticate, canUpdate('pos_imports'), stagingController.update);

// Manual reprocess — proses semua data di tr_saleshead
router.post("/reprocess-aggregates", authenticate, canInsert('pos_imports'), async (req, res) => {
  try {
    console.log("🔄 Manual reprocess aggregates triggered");
    // Fire and forget — tidak block response
    processPosSyncAggregates()
      .then((result: any) => {
        console.log("✅ Reprocess complete:", result);
      })
      .catch((err: any) => {
        logError("Reprocess failed", { err });
      });
    res.json({
      success: true,
      message: "Reprocess started in background — cek log untuk hasilnya",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

router.post("/recalculate", authenticate, canUpdate('pos_imports'), aggregateController.recalculateByDate);

export default router;

