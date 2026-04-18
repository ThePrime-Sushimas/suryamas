import { Router } from "express";
import { cashFlowSalesController } from "./cash-flow-sales.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveBranchContext } from "../../middleware/branch-context.middleware";
import { validateSchema } from "../../middleware/validation.middleware";
import { canView, canInsert, canUpdate, canDelete } from "../../middleware/permission.middleware";
import {
  createPeriodBalanceSchema,
  updatePeriodBalanceSchema,
  deletePeriodBalanceSchema,
  getSuggestionSchema,
  listPeriodsSchema,
  createGroupSchema,
  updateGroupSchema,
  deleteGroupSchema,
  reorderGroupsSchema,
  getCashFlowDailySchema,
} from "./cash-flow-sales.schema";

const MODULE = "cash_flow";
const router = Router();

router.use(authenticate);
router.use(resolveBranchContext);

// Period Balance
router.get("/periods", canView(MODULE), validateSchema(listPeriodsSchema), cashFlowSalesController.listPeriods);
router.post("/periods", canInsert(MODULE), validateSchema(createPeriodBalanceSchema), cashFlowSalesController.createPeriod);
router.put("/periods/:id", canUpdate(MODULE), validateSchema(updatePeriodBalanceSchema), cashFlowSalesController.updatePeriod);
router.delete("/periods/:id", canDelete(MODULE), validateSchema(deletePeriodBalanceSchema), cashFlowSalesController.deletePeriod);

// Suggestion
router.get("/suggestion", canView(MODULE), validateSchema(getSuggestionSchema), cashFlowSalesController.getSuggestion);

// Payment Method Groups
router.get("/groups", canView(MODULE), cashFlowSalesController.listGroups);
router.post("/groups", canInsert(MODULE), validateSchema(createGroupSchema), cashFlowSalesController.createGroup);
router.put("/groups/reorder", canUpdate(MODULE), validateSchema(reorderGroupsSchema), cashFlowSalesController.reorderGroups);
router.put("/groups/:id", canUpdate(MODULE), validateSchema(updateGroupSchema), cashFlowSalesController.updateGroup);
router.delete("/groups/:id", canDelete(MODULE), validateSchema(deleteGroupSchema), cashFlowSalesController.deleteGroup);

// Cash Flow Daily
router.get("/daily", canView(MODULE), validateSchema(getCashFlowDailySchema), cashFlowSalesController.getCashFlowDaily);

// Branches
router.get("/branches", canView(MODULE), cashFlowSalesController.getBranches);

export default router;
