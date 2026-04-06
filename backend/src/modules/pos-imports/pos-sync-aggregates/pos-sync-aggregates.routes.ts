import { Router } from "express";
import { authenticate } from "../../../middleware/auth.middleware";
import { posSyncAggregatesController } from "./pos-sync-aggregates.controller";

const router = Router();

router.get("/", authenticate, posSyncAggregatesController.list);
router.get("/:id", authenticate, posSyncAggregatesController.getById);
router.get("/:id/lines", authenticate, posSyncAggregatesController.getLines);
router.post(
  "/:id/reconcile",
  authenticate,
  posSyncAggregatesController.reconcile,
);
router.post(
  "/:id/undo-reconcile",
  authenticate,
  posSyncAggregatesController.undoReconcile,
);

export default router;
