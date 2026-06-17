import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import {
  AssetCategoryDuplicateError,
  AssetCategoryInUseError,
} from '../fixed-assets.errors'

// Mock repository module (service imports it as namespace)
jest.mock('../fixed-assets.repository', () => ({
  findCategoryByCode: jest.fn(),
  createCategory: jest.fn(),
  findCategoryById: jest.fn(),
  updateCategory: jest.fn(),
  isCategoryInUse: jest.fn(),
  softDeleteCategory: jest.fn(),
  findCategoryByIdIncludeDeleted: jest.fn(),
  restoreCategory: jest.fn(),
}))

// Mock postgres error helper
jest.mock('../../../utils/postgres-error.util', () => ({
  isPostgresError: jest.fn(),
}))

import * as repo from '../fixed-assets.repository'
import { isPostgresError } from '../../../utils/postgres-error.util'
import * as service from '../fixed-assets.service'

describe('fixed-assets.service (categories)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('rejects duplicate category_code within same company', async () => {
    ;(repo.findCategoryByCode as any).mockResolvedValue({ id: 'cat-1' })

    await expect(
      service.createCategory(
        {
          category_code: 'PRL',
          category_name: 'Peralatan',
          asset_coa_id: 'a',
          depreciation_expense_coa_id: 'b',
          accumulated_depreciation_coa_id: 'c',
          default_useful_life_months: 60,
        },
        'company-1',
        'user-1',
      ),
    ).rejects.toBeInstanceOf(AssetCategoryDuplicateError)
  })

  it('maps PG 23505 to AssetCategoryDuplicateError (race-safe)', async () => {
    ;(repo.findCategoryByCode as any).mockResolvedValue(null)
    ;(repo.createCategory as any).mockRejectedValue(new Error('unique violation'))
    ;(isPostgresError as any).mockReturnValue(true)

    await expect(
      service.createCategory(
        {
          category_code: 'PRL',
          category_name: 'Peralatan',
          asset_coa_id: 'a',
          depreciation_expense_coa_id: 'b',
          accumulated_depreciation_coa_id: 'c',
          default_useful_life_months: 60,
        },
        'company-1',
        'user-1',
      ),
    ).rejects.toBeInstanceOf(AssetCategoryDuplicateError)
  })

  it('deleteCategory blocks when category in use', async () => {
    ;(repo.findCategoryById as any).mockResolvedValue({ id: 'cat-1' })
    ;(repo.isCategoryInUse as any).mockResolvedValue(true)

    await expect(service.deleteCategory('cat-1', 'company-1', 'user-1')).rejects.toBeInstanceOf(
      AssetCategoryInUseError,
    )
  })
})

