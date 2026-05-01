import { Router } from "express";
import { requireApiKey } from "../../middleware/api-key.middleware";
import { handleError } from "../../utils/error-handler.util";
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
import { AuditService } from "../monitoring/monitoring.service";

const router = Router();

// Register module permissions
PermissionService.registerModule(
  "pos_sync",
  "POS Sync & Staging Management",
).catch((error) => {
  console.error("Failed to register pos_sync module:", error.message);
});

router.post("/import", requireApiKey, (req, res) => salesController.import(req, res));
router.post("/master", requireApiKey, (req, res) => masterController.sync(req, res));

// Staging routes protected by pos_sync module permissions
router.get(
  "/staging/:table",
  authenticate,
  resolveBranchContext,
  canView("pos_sync"),
  (req, res) => stagingController.list(req, res),
);
router.patch(
  "/staging/:table/:id",
  authenticate,
  resolveBranchContext,
  canUpdate("pos_sync"),
  (req, res) => stagingController.update(req, res),
);

// Manual reprocess — proses semua data di tr_saleshead
router.post(
  "/reprocess-aggregates",
  authenticate,
  resolveBranchContext,
  canInsert("pos_sync"),
  async (req, res) => {
    try {
      // Fire and forget — tidak block response
      processPosSyncAggregates()
        .then(async (result: unknown) => {
          const userId = req.user?.id ?? null;
          await AuditService.log(
            "MANUAL_REPROCESS",
            "pos_sync_aggregates",
            "system",
            userId,
            null,
            result,
            req.ip,
            req.get("user-agent")
          );
        })
        .catch((err: unknown) => {
          logError("Reprocess failed", { err });
        });
      res.json({
        success: true,
        message: "Reprocess started in background — cek log untuk hasilnya",
      });
    } catch (err: unknown) {
      await handleError(res, err, req, { action: 'reprocess_aggregates' });
    }
  },
);

router.post(
  "/recalculate",
  authenticate,
  resolveBranchContext,
  canUpdate("pos_sync"),
  (req, res) => aggregateController.recalculateByDate(req, res),
);

export default router;
