import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveBranchContext } from "../../middleware/branch-context.middleware";
import {
  canView,
  canInsert,
  canUpdate,
  canDelete,
  canApprove,
} from "../../middleware/permission.middleware";
import { validateSchema } from "../../middleware/validation.middleware";
import { purchaseInvoicesController } from "./purchase-invoices.controller";
import {
  availableGrsSchema,
  createPurchaseInvoiceSchema,
  deletePurchaseInvoiceSchema,
  listPurchaseInvoicesSchema,
  postPurchaseInvoiceSchema,
  purchaseInvoiceIdParamSchema,
  rejectPurchaseInvoiceSchema,
  approvePurchaseInvoiceSchema,
  submitPurchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
} from "./purchase-invoices.schema";
import { PermissionService } from "../../services/permission.service";

PermissionService.registerModule(
  "purchase_invoices",
  "Purchase Invoices Verification",
).catch(() => {});

const router = Router();

router.use(authenticate, resolveBranchContext);

router.get(
  "/",
  canView("purchase_invoices"),
  validateSchema(listPurchaseInvoicesSchema),
  (req, res) => purchaseInvoicesController.list(req, res),
);
router.get(
  "/available-grs",
  canView("purchase_invoices"),
  validateSchema(availableGrsSchema),
  (req, res) => purchaseInvoicesController.availableGrs(req, res),
);
router.get(
  "/:id",
  canView("purchase_invoices"),
  validateSchema(purchaseInvoiceIdParamSchema),
  (req, res) => purchaseInvoicesController.getById(req, res),
);

router.post(
  "/",
  canInsert("purchase_invoices"),
  validateSchema(createPurchaseInvoiceSchema),
  (req, res) => purchaseInvoicesController.create(req, res),
);
router.put(
  "/:id",
  canUpdate("purchase_invoices"),
  validateSchema(updatePurchaseInvoiceSchema),
  (req, res) => purchaseInvoicesController.update(req, res),
);
router.delete(
  "/:id",
  canDelete("purchase_invoices"),
  validateSchema(deletePurchaseInvoiceSchema),
  (req, res) => purchaseInvoicesController.delete(req, res),
);

router.post(
  "/:id/submit",
  canUpdate("purchase_invoices"),
  validateSchema(submitPurchaseInvoiceSchema),
  (req, res) => purchaseInvoicesController.submit(req, res),
);
router.post(
  "/:id/approve",
  canApprove("purchase_invoices"),
  validateSchema(approvePurchaseInvoiceSchema),
  (req, res) => purchaseInvoicesController.approve(req, res),
);
router.post(
  "/:id/reject",
  canApprove("purchase_invoices"),
  validateSchema(rejectPurchaseInvoiceSchema),
  (req, res) => purchaseInvoicesController.reject(req, res),
);
router.post(
  "/:id/post",
  canApprove("purchase_invoices"),
  validateSchema(postPurchaseInvoiceSchema),
  (req, res) => purchaseInvoicesController.post(req, res),
);

export default router;
