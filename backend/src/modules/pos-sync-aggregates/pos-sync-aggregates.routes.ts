import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveBranchContext } from "../../middleware/branch-context.middleware";
import { canView, canUpdate } from "../../middleware/permission.middleware";
import { posSyncAggregatesController } from "./pos-sync-aggregates.controller";
import { PermissionService } from "../../services/permission.service";

const router = Router();

// Register module permissions
PermissionService.registerModule('pos_sync_aggregates', 'POS Sync Aggregates Management').catch((error) => {
  console.error('Failed to register pos_sync_aggregates module:', error.message)
})

// POS Sync Aggregates routes protected by pos_sync_aggregates module permissions
router.get("/", authenticate, resolveBranchContext, canView('pos_sync_aggregates'), posSyncAggregatesController.list);
router.get("/:id", authenticate, resolveBranchContext, canView('pos_sync_aggregates'), posSyncAggregatesController.getById);
router.get("/:id/lines", authenticate, resolveBranchContext, canView('pos_sync_aggregates'), posSyncAggregatesController.getLines);

router.post(
  "/:id/reconcile",
  authenticate,
  resolveBranchContext,
  canUpdate('pos_sync_aggregates'),
  posSyncAggregatesController.reconcile,
);

export default router;

