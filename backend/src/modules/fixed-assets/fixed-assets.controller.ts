import type { Request, Response } from 'express'
import * as fixedAssetsService from './fixed-assets.service'
import * as depreciationService from './depreciation.service'
import * as assetLifecycleService from './asset-lifecycle.service'
import { handleError } from '../../utils/error-handler.util'
import { sendSuccess } from '../../utils/response.util'
import { getAccessibleCompanyIds, resolveContextCompanyId } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
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
  listDisposalsSchema,
  createDisposalSchema,
  postDisposalSchema,
  listDepreciationRunsSchema,
  previewDepreciationSchema,
  confirmDepreciationSchema,
  reverseDepreciationSchema,
  activateAssetSchema,
  createOpeningBalanceSchema,
  previewDepreciationCalcSchema,
} from './fixed-assets.schema'

async function assetScope(req: Request) {
  const userId = req.user?.id ?? ''
  const companyIds = await getAccessibleCompanyIds(userId)
  const companyId = resolveContextCompanyId(req.context?.company_id ?? '', companyIds)
  return { userId, companyId }
}

// ─── Asset Categories ────────────────────────────────────────────────────────

export const listCategories = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const query = (req as ValidatedAuthRequest<typeof listAssetCategoriesSchema>).validated.query
    const result = await fixedAssetsService.getCategories(companyId, {
      page: query.page,
      limit: query.limit,
      search: query.search,
      is_active: query.is_active,
    })
    sendSuccess(res, result.data, 'Asset categories retrieved', 200, result.pagination)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'list_asset_categories' })
  }
}

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const body = (req as ValidatedAuthRequest<typeof createAssetCategorySchema>).validated.body
    const category = await fixedAssetsService.createCategory(body, companyId, userId)
    sendSuccess(res, category, 'Asset category created', 201)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'create_asset_category' })
  }
}

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof fixedAssetIdParamSchema>).validated.params
    const category = await fixedAssetsService.getCategoryById(id, companyId)
    sendSuccess(res, category, 'Asset category retrieved')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_asset_category', id: req.params.id })
  }
}

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof updateAssetCategorySchema>).validated.params
    const body = (req as ValidatedAuthRequest<typeof updateAssetCategorySchema>).validated.body
    const category = await fixedAssetsService.updateCategory(id, body, companyId, userId)
    sendSuccess(res, category, 'Asset category updated')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'update_asset_category', id: req.params.id })
  }
}

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof fixedAssetIdParamSchema>).validated.params
    await fixedAssetsService.deleteCategory(id, companyId, userId)
    sendSuccess(res, null, 'Asset category deleted')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'delete_asset_category', id: req.params.id })
  }
}

export const restoreCategory = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof fixedAssetIdParamSchema>).validated.params
    const category = await fixedAssetsService.restoreCategory(id, companyId, userId)
    sendSuccess(res, category, 'Asset category restored')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'restore_asset_category', id: req.params.id })
  }
}

// ─── Fixed Assets ────────────────────────────────────────────────────────────

export const listAssets = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const query = (req as ValidatedAuthRequest<typeof listFixedAssetsSchema>).validated.query
    const result = await fixedAssetsService.getAssets(companyId, {
      page: query.page,
      limit: query.limit,
      branch_id: query.branch_id,
      status: query.status,
      asset_category_id: query.category_id,
      search: query.search,
      date_from: query.date_from,
      date_to: query.date_to,
    })
    sendSuccess(res, result.data, 'Fixed assets retrieved', 200, result.pagination)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'list_fixed_assets' })
  }
}

export const getAssetById = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof fixedAssetIdParamSchema>).validated.params
    const asset = await fixedAssetsService.getAssetById(id, companyId)
    sendSuccess(res, asset, 'Fixed asset retrieved')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_fixed_asset', id: req.params.id })
  }
}

export const updateAsset = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof updateFixedAssetSchema>).validated.params
    const body = (req as ValidatedAuthRequest<typeof updateFixedAssetSchema>).validated.body
    const asset = await fixedAssetsService.updateAsset(id, body, companyId, userId)
    sendSuccess(res, asset, 'Fixed asset updated')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'update_fixed_asset', id: req.params.id })
  }
}

export const getMovements = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const { params, query } = (req as ValidatedAuthRequest<typeof listMovementsSchema>).validated
    const result = await fixedAssetsService.getMovements(params.id, companyId, {
      page: query.page,
      limit: query.limit,
      movement_type: query.movement_type,
    })
    sendSuccess(res, result.data, 'Asset movements retrieved', 200, result.pagination)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_asset_movements', id: req.params.id })
  }
}

export const regenerateQrCode = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof regenerateQrCodeSchema>).validated.params
    const result = await fixedAssetsService.regenerateQrCode(id, companyId, userId)
    sendSuccess(res, result, 'QR code regenerated')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'regenerate_qr_code', id: req.params.id })
  }
}

export const bulkQrPdf = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const { asset_ids } = (req as ValidatedAuthRequest<typeof bulkQrCodeSchema>).validated.body
    const { pdf } = await fixedAssetsService.bulkQrPdf(asset_ids, companyId)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="asset-qr-codes.pdf"')
    res.setHeader('Content-Length', pdf.length)
    res.send(pdf)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'bulk_qr_pdf' })
  }
}

// ─── Activate Asset (DRAFT → ACTIVE) ─────────────────────────────────────────

export const activateAsset = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof activateAssetSchema>).validated.params
    const body = (req as ValidatedAuthRequest<typeof activateAssetSchema>).validated.body
    const asset = await fixedAssetsService.activateAsset(id, companyId, userId, body?.capitalized_date)
    sendSuccess(res, asset, 'Asset activated')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'activate_asset', id: req.params.id })
  }
}

// ─── Asset Transfers ─────────────────────────────────────────────────────────

export const listTransfers = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const query = (req as ValidatedAuthRequest<typeof listTransfersSchema>).validated.query
    const result = await fixedAssetsService.listTransfers(companyId, {
      page: query.page,
      limit: query.limit,
      fixed_asset_id: query.fixed_asset_id,
      branch_id: query.branch_id,
      date_from: query.date_from,
      date_to: query.date_to,
    })
    sendSuccess(res, result.data, 'Asset transfers retrieved', 200, result.pagination)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'list_asset_transfers' })
  }
}

export const createTransfer = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const body = (req as ValidatedAuthRequest<typeof createTransferSchema>).validated.body
    await assetLifecycleService.transferAsset(body, companyId, userId)
    sendSuccess(res, null, 'Asset transferred successfully', 201)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'create_asset_transfer' })
  }
}

// ─── Asset Maintenance ───────────────────────────────────────────────────────

export const listMaintenance = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const query = (req as ValidatedAuthRequest<typeof listMaintenanceSchema>).validated.query
    const result = await fixedAssetsService.listMaintenance(companyId, {
      page: query.page,
      limit: query.limit,
      fixed_asset_id: query.fixed_asset_id,
      status: query.status,
      search: query.search,
      date_from: query.date_from,
      date_to: query.date_to,
    })
    sendSuccess(res, result.data, 'Maintenance records retrieved', 200, result.pagination)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'list_asset_maintenance' })
  }
}

export const createMaintenance = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const body = (req as ValidatedAuthRequest<typeof createMaintenanceSchema>).validated.body
    await assetLifecycleService.recordMaintenance(body, companyId, userId)
    sendSuccess(res, null, 'Maintenance recorded', 201)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'create_asset_maintenance' })
  }
}

export const completeMaintenance = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof completeMaintenanceSchema>).validated.params
    await assetLifecycleService.completeMaintenance(id, companyId, userId)
    sendSuccess(res, null, 'Maintenance completed')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'complete_maintenance', id: req.params.id })
  }
}

// ─── Asset Disposals ─────────────────────────────────────────────────────────

export const listDisposals = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const query = (req as ValidatedAuthRequest<typeof listDisposalsSchema>).validated.query
    const result = await fixedAssetsService.listDisposals(companyId, {
      page: query.page,
      limit: query.limit,
      fixed_asset_id: query.fixed_asset_id,
      status: query.status,
      disposal_method: query.disposal_method,
      date_from: query.date_from,
      date_to: query.date_to,
    })
    sendSuccess(res, result.data, 'Disposals retrieved', 200, result.pagination)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'list_asset_disposals' })
  }
}

export const createDisposal = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const body = (req as ValidatedAuthRequest<typeof createDisposalSchema>).validated.body
    const disposal = await assetLifecycleService.createDisposal(body, companyId, userId)
    sendSuccess(res, disposal, 'Disposal created', 201)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'create_asset_disposal' })
  }
}

export const postDisposal = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof postDisposalSchema>).validated.params
    await assetLifecycleService.postDisposal(id, companyId, userId)
    sendSuccess(res, null, 'Disposal posted')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'post_disposal', id: req.params.id })
  }
}

// ─── Depreciation Runs ───────────────────────────────────────────────────────

export const listDepreciationRuns = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const query = (req as ValidatedAuthRequest<typeof listDepreciationRunsSchema>).validated.query
    const result = await fixedAssetsService.listDepreciationRuns(companyId, {
      page: query.page,
      limit: query.limit,
      status: query.status,
      fiscal_period_id: query.fiscal_period_id,
    })
    sendSuccess(res, result.data, 'Depreciation runs retrieved', 200, result.pagination)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'list_depreciation_runs' })
  }
}

export const previewDepreciation = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { fiscal_period_id } = (req as ValidatedAuthRequest<typeof previewDepreciationSchema>).validated.body
    const result = await depreciationService.executeDepreciationRun(
      companyId,
      fiscal_period_id,
      'PREVIEW',
      userId,
    )
    sendSuccess(res, result, 'Depreciation preview generated')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'preview_depreciation' })
  }
}

export const confirmDepreciation = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { fiscal_period_id } = (req as ValidatedAuthRequest<typeof confirmDepreciationSchema>).validated.body
    const result = await depreciationService.executeDepreciationRun(
      companyId,
      fiscal_period_id,
      'CONFIRM',
      userId,
    )
    sendSuccess(res, result, 'Depreciation run confirmed and posted', 201)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'confirm_depreciation' })
  }
}

export const reverseDepreciation = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const { id } = (req as ValidatedAuthRequest<typeof reverseDepreciationSchema>).validated.params
    await depreciationService.reverseDepreciationRun(id, companyId, userId)
    sendSuccess(res, null, 'Depreciation run reversed')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'reverse_depreciation', id: req.params.id })
  }
}

// ─── Asset Photos ────────────────────────────────────────────────────────────

export const listPhotos = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const id = req.params.id as string
    const photos = await fixedAssetsService.listPhotos(id, companyId)
    sendSuccess(res, photos, 'Asset photos retrieved')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'list_asset_photos', id: req.params.id as string })
  }
}

export const uploadPhoto = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const id = req.params.id as string
    const file = req.file
    if (!file) {
      res.status(400).json({ success: false, message: 'File is required' })
      return
    }
    const photo = await fixedAssetsService.uploadPhoto(id, companyId, userId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    })
    sendSuccess(res, photo, 'Photo uploaded', 201)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'upload_asset_photo', id: req.params.id as string })
  }
}

export const deletePhoto = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const id = req.params.id as string
    const photoId = req.params.photoId as string
    await fixedAssetsService.deletePhoto(id, photoId, companyId, userId)
    sendSuccess(res, null, 'Photo deleted')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'delete_asset_photo', id: req.params.id as string })
  }
}

// ─── Opening Balance ─────────────────────────────────────────────────────────

export const getEquityAccounts = async (req: Request, res: Response) => {
  try {
    const { companyId } = await assetScope(req)
    const accounts = await fixedAssetsService.getEquityAccounts(companyId)
    sendSuccess(res, accounts)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_equity_accounts' })
  }
}

export const previewDepreciationCalc = async (req: Request, res: Response) => {
  try {
    const query = (req as ValidatedAuthRequest<typeof previewDepreciationCalcSchema>).validated.query
    const result = fixedAssetsService.previewDepreciationCalc(
      query.acquisition_date,
      query.cost,
      query.salvage_value,
      query.useful_life_months,
    )
    sendSuccess(res, result)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'preview_depreciation_calc' })
  }
}

export const createOpeningBalance = async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = await assetScope(req)
    const body = (req as ValidatedAuthRequest<typeof createOpeningBalanceSchema>).validated.body
    const asset = await fixedAssetsService.createOpeningBalance({
      ...body,
      company_id: companyId,
      created_by: userId,
    })
    sendSuccess(res, asset, 'Saldo awal aset berhasil dibuat', 201)
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'create_opening_balance' })
  }
}
