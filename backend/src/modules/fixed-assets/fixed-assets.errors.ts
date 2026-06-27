import { BusinessRuleError, NotFoundError, ConflictError } from '../../utils/errors.base'

export class AssetCategoryNotFoundError extends NotFoundError {
  constructor(id?: string) { super('Asset category', id) }
}

export class AssetCategoryInUseError extends BusinessRuleError {
  constructor() { super('Cannot delete asset category that has linked fixed assets') }
}

export class AssetCategoryDuplicateError extends ConflictError {
  constructor(code: string) { super(`Asset category with code '${code}' already exists`) }
}

export class FixedAssetNotFoundError extends NotFoundError {
  constructor(id?: string) { super('Fixed asset', id) }
}

export class AssetNotActiveError extends BusinessRuleError {
  constructor(assetCode: string, currentStatus: string) {
    super(`Asset '${assetCode}' is not active (current status: ${currentStatus})`)
  }
}

export class AssetAlreadyActiveError extends BusinessRuleError {
  constructor(assetCode: string) {
    super(`Asset '${assetCode}' is already ACTIVE`)
  }
}

export class AssetNotFoundForInvoiceError extends NotFoundError {
  constructor(productName: string, grLineId: string) {
    super(`Fixed asset for product '${productName}' (GR line: ${grLineId})`)
  }
}

export class DepreciationAlreadyPostedError extends ConflictError {
  constructor(periodName: string) {
    super(`Depreciation has already been posted for period '${periodName}'`)
  }
}

export class CrossCompanyTransferError extends BusinessRuleError {
  constructor() { super('Cannot transfer asset to a branch belonging to a different company') }
}

export class PeriodNotOpenError extends BusinessRuleError {
  constructor() { super('Fiscal period is not open for posting') }
}

export class DisposalInvalidStatusError extends BusinessRuleError {
  constructor(assetCode: string, currentStatus: string) {
    super(`Cannot dispose asset '${assetCode}': status must be ACTIVE, but is '${currentStatus}'`)
  }
}

export class BranchNotFoundError extends NotFoundError {
  constructor(id?: string) { super('Branch', id) }
}

export class MaintenanceNotFoundError extends NotFoundError {
  constructor(id?: string) { super('Asset maintenance', id) }
}

export class MaintenanceInvalidStatusError extends BusinessRuleError {
  constructor(expected: string, actual: string) {
    super(`Maintenance record must be in '${expected}' status, but is '${actual}'`)
  }
}

export class DisposalNotFoundError extends NotFoundError {
  constructor(id?: string) { super('Asset disposal', id) }
}

export class DisposalAlreadyPostedError extends BusinessRuleError {
  constructor() { super('Disposal is already posted') }
}

export class DepreciationRunNotFoundError extends NotFoundError {
  constructor(id?: string) { super('Depreciation run', id) }
}

export class DepreciationRunInvalidStatusError extends BusinessRuleError {
  constructor(expected: string, actual: string) {
    super(`Depreciation run must be in '${expected}' status, but is '${actual}'`)
  }
}

export class CoaNotFoundError extends NotFoundError {
  constructor(code: string) { super(`Chart of account with code '${code}'`) }
}

export class PooledAssetRevertError extends BusinessRuleError {
  constructor(assetCode: string, detail: string) {
    super(`Tidak dapat revert penambahan pool aset ${assetCode}: ${detail}`, { asset_code: assetCode })
  }
}
