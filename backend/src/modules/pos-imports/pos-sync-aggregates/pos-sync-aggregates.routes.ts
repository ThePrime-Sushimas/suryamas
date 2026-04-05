import { Router } from "express";
import { authenticate } from "../../../middleware/auth.middleware";
import { posSyncAggregatesController } from "./pos-sync-aggregates.controller";

const router = Router();

router.get("/", authenticate, posSyncAggregatesController.list);
router.get("/:id", authenticate, posSyncAggregatesController.getById);
router.get("/:id/lines", authenticate, posSyncAggregatesController.getLines);

export default router;
