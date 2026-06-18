import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import { canView, canUpdate, canDelete, canApprove } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { documentUploadSingle } from '../../middleware/upload-document.middleware'
import { PermissionService } from '../../services/permission.service'
import * as controller from './fixed-assets.controller'
import {
  listAssetCategoriesSchema,
  createAssetCategorySchema,
  updateAssetCategorySchema,
  fixedAssetIdParamSchema,
  listFixedAssetsSchema,
  updateFixedAssetSchema,
  listMovementsSchema,
  regenerateQrCodeSchema,
  bulkQrCodeSchema,
  listTransfersSchema,
  createTransferSchema,
  listMaintenanceSchema,
  createMaintenanceSchema,
  completeMaintenanceSchema,
  postMaintenanceSchema,
  listDisposalsSchema,
  createDisposalSchema,
  postDisposalSchema,
  listDepreciationRunsSchema,
  previewDepreciationSchema,
  confirmDepreciationSchema,
  reverseDepreciationSchema,
  activateAssetSchema,
} from './fixed-assets.schema'

// ─── Module registration ──────────────────────────────────────────────────────

PermissionService.registerModule('fixed_assets', 'Fixed Assets / Aset Tetap').catch((err) => {
  console.error('Failed to register fixed_assets module:', err instanceof Error ? err.message : err)
})

const router = Router()

// Apply auth + branch context to all routes
router.use(authenticate, resolveBranchContext)

// ============================================================
// ASSET CATEGORIES  →  /api/v1/asset-categories
// ============================================================
router.get(    '/asset-categories',     canView('fixed_assets'),   validateSchema(listAssetCategoriesSchema), (req, res) => controller.listCategories(req, res))
router.post(   '/asset-categories',     requireWriteAccess, canUpdate('fixed_assets'), validateSchema(createAssetCategorySchema), (req, res) => controller.createCategory(req, res))
router.get(    '/asset-categories/:id', canView('fixed_assets'),   validateSchema(fixedAssetIdParamSchema),   (req, res) => controller.getCategoryById(req, res))
router.put(    '/asset-categories/:id', requireWriteAccess, canUpdate('fixed_assets'), validateSchema(updateAssetCategorySchema), (req, res) => controller.updateCategory(req, res))
router.patch(  '/asset-categories/:id/restore', requireWriteAccess, canUpdate('fixed_assets'), validateSchema(fixedAssetIdParamSchema), (req, res) => controller.restoreCategory(req, res))
router.delete( '/asset-categories/:id', requireWriteAccess, canDelete('fixed_assets'), validateSchema(fixedAssetIdParamSchema),   (req, res) => controller.deleteCategory(req, res))

// ============================================================
// FIXED ASSETS  →  /api/v1/fixed-assets
// ============================================================

// NOTE: /bulk-qr must be registered BEFORE /:id to avoid route conflict
router.post(   '/fixed-assets/bulk-qr',          canView('fixed_assets'),   validateSchema(bulkQrCodeSchema),         (req, res) => controller.bulkQrPdf(req, res))
router.get(    '/fixed-assets',                   canView('fixed_assets'),   validateSchema(listFixedAssetsSchema),    (req, res) => controller.listAssets(req, res))
router.get(    '/fixed-assets/:id',               canView('fixed_assets'),   validateSchema(fixedAssetIdParamSchema),  (req, res) => controller.getAssetById(req, res))
router.put(    '/fixed-assets/:id',               requireWriteAccess, canUpdate('fixed_assets'), validateSchema(updateFixedAssetSchema),   (req, res) => controller.updateAsset(req, res))
router.post(   '/fixed-assets/:id/activate',      requireWriteAccess, canUpdate('fixed_assets'), validateSchema(activateAssetSchema),      (req, res) => controller.activateAsset(req, res))
router.get(    '/fixed-assets/:id/movements',     canView('fixed_assets'),   validateSchema(listMovementsSchema),      (req, res) => controller.getMovements(req, res))
router.post(   '/fixed-assets/:id/qr-code',       requireWriteAccess, canUpdate('fixed_assets'), validateSchema(regenerateQrCodeSchema),   (req, res) => controller.regenerateQrCode(req, res))

// ── Asset Photos ──
router.get(    '/fixed-assets/:id/photos',         canView('fixed_assets'),   (req, res) => controller.listPhotos(req, res))
router.post(   '/fixed-assets/:id/photos',         requireWriteAccess, canUpdate('fixed_assets'), documentUploadSingle('photo'), (req, res) => controller.uploadPhoto(req, res))
router.delete( '/fixed-assets/:id/photos/:photoId', requireWriteAccess, canUpdate('fixed_assets'), (req, res) => controller.deletePhoto(req, res))

// ============================================================
// ASSET TRANSFERS  →  /api/v1/asset-transfers
// ============================================================
router.get(    '/asset-transfers',  canView('fixed_assets'),   validateSchema(listTransfersSchema),  (req, res) => controller.listTransfers(req, res))
router.post(   '/asset-transfers',  requireWriteAccess, canUpdate('fixed_assets'), validateSchema(createTransferSchema), (req, res) => controller.createTransfer(req, res))

// ============================================================
// ASSET MAINTENANCE  →  /api/v1/asset-maintenance
// ============================================================
router.get(    '/asset-maintenance',              canView('fixed_assets'),    validateSchema(listMaintenanceSchema),    (req, res) => controller.listMaintenance(req, res))
router.post(   '/asset-maintenance',              requireWriteAccess, canUpdate('fixed_assets'),  validateSchema(createMaintenanceSchema),  (req, res) => controller.createMaintenance(req, res))
router.post(   '/asset-maintenance/:id/complete', requireWriteAccess, canUpdate('fixed_assets'),  validateSchema(completeMaintenanceSchema), (req, res) => controller.completeMaintenance(req, res))
router.post(   '/asset-maintenance/:id/post',     requireWriteAccess, canApprove('fixed_assets'), validateSchema(postMaintenanceSchema),   (req, res) => controller.postMaintenance(req, res))

// ============================================================
// ASSET DISPOSALS  →  /api/v1/asset-disposals
// ============================================================
router.get(    '/asset-disposals',          canView('fixed_assets'),    validateSchema(listDisposalsSchema),  (req, res) => controller.listDisposals(req, res))
router.post(   '/asset-disposals',          requireWriteAccess, canApprove('fixed_assets'), validateSchema(createDisposalSchema), (req, res) => controller.createDisposal(req, res))
router.post(   '/asset-disposals/:id/post', requireWriteAccess, canApprove('fixed_assets'), validateSchema(postDisposalSchema),  (req, res) => controller.postDisposal(req, res))

// ============================================================
// DEPRECIATION RUNS  →  /api/v1/depreciation-runs
// ============================================================

// NOTE: /preview and /confirm must be registered BEFORE /:id to avoid route conflict
router.post(   '/depreciation-runs/preview', requireWriteAccess, canApprove('fixed_assets'), validateSchema(previewDepreciationSchema),  (req, res) => controller.previewDepreciation(req, res))
router.post(   '/depreciation-runs/confirm', requireWriteAccess, canApprove('fixed_assets'), validateSchema(confirmDepreciationSchema),  (req, res) => controller.confirmDepreciation(req, res))
router.get(    '/depreciation-runs',         canView('fixed_assets'),    validateSchema(listDepreciationRunsSchema), (req, res) => controller.listDepreciationRuns(req, res))
router.post(   '/depreciation-runs/:id/reverse', requireWriteAccess, canApprove('fixed_assets'), validateSchema(reverseDepreciationSchema), (req, res) => controller.reverseDepreciation(req, res))

export default router
