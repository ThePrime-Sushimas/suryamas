import { Router } from "express";
import { authenticate } from "../../../middleware/auth.middleware";
import { canView, canUpdate } from "../../../middleware/permission.middleware";
import { posSyncAggregatesController } from "./pos-sync-aggregates.controller";
import { PermissionService } from "../../../services/permission.service";

const router = Router();

// Register module permissions
PermissionService.registerModule('pos_imports', 'POS Imports & Staging Management').catch((error) => {
  console.error('Failed to register pos_imports module:', error.message)
})



// POS Sync Aggregates routes protected by pos_imports module permissions
router.get("/", authenticate, canView('pos_imports'), posSyncAggregatesController.list);
router.get("/:id", authenticate, canView('pos_imports'), posSyncAggregatesController.getById);
router.get("/:id/lines", authenticate, canView('pos_imports'), posSyncAggregatesController.getLines);

router.post(
  "/:id/reconcile",
  authenticate,
  canUpdate('pos_imports'),
  posSyncAggregatesController.reconcile,
);

router.post(
  "/:id/undo-reconcile",
  authenticate,
  canUpdate('pos_imports'),
  posSyncAggregatesController.undoReconcile,
);

export default router;

