import { Router } from "express";
import { requireApiKey } from "../../middleware/api-key.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import {
  canView,
  canUpdate,
  canInsert,
} from "../../middleware/permission.middleware";
import { PermissionService } from "../../services/permission.service";
import {
  salesController,
  masterController,
  stagingController,
  aggregateController,
} from "./pos-sync.controller";
import { processPosSyncAggregates } from "@/modules/jobs/processors/pos-sync-aggregates.processor";
import { logError } from "../../config/logger";
import { resolveBranchContext } from "@/middleware/branch-context.middleware";

const router = Router();

// Register module permissions
PermissionService.registerModule(
  "pos_sync",
  "POS Sync & Staging Management",
).catch((error) => {
  console.error("Failed to register pos_sync module:", error.message);
});

router.post("/import", requireApiKey, salesController.import);
router.post("/master", requireApiKey, masterController.sync);

// Staging routes protected by pos_sync module permissions
router.get(
  "/staging/:table",
  authenticate,
  resolveBranchContext,
  canView("pos_sync"),
  stagingController.list,
);
router.patch(
  "/staging/:table/:id",
  authenticate,
  resolveBranchContext,
  canUpdate("pos_sync"),
  stagingController.update,
);

// Manual reprocess — proses semua data di tr_saleshead
router.post(
  "/reprocess-aggregates",
  authenticate,
  resolveBranchContext,
  canInsert("pos_sync"),
  async (req, res) => {
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
  },
);

router.post(
  "/recalculate",
  authenticate,
  resolveBranchContext,
  canUpdate("pos_sync"),
  aggregateController.recalculateByDate,
);

export default router;
