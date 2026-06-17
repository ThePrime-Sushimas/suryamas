import { describe, it, expect } from '@jest/globals'
import { calculateMonthlyDepreciation } from '../depreciation.service'
import type { FixedAsset } from '../fixed-assets.types'

function makeAsset(partial: Partial<FixedAsset>): FixedAsset {
  return {
    id: 'asset-1',
    company_id: 'company-1',
    branch_id: 'branch-1',
    asset_code: 'CAT-BR-0001',
    asset_name: 'Asset',
    asset_category_id: 'cat-1',
    product_id: null,
    status: 'ACTIVE',
    acquisition_date: '2026-01-01',
    capitalized_date: '2026-01-01',
    cost: 0,
    salvage_value: 0,
    useful_life_months: 60,
    depreciation_method: 'STRAIGHT_LINE',
    accumulated_depreciation: 0,
    book_value: 0,
    gr_line_id: null,
    purchase_invoice_id: null,
    journal_id: null,
    qr_code_url: null,
    photo_url: null,
    description: null,
    serial_number: null,
    location_note: null,
    is_deleted: false,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: null,
    updated_by: null,
    ...partial,
  }
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000
}

describe('calculateMonthlyDepreciation()', () => {
  it('returns 0 when remaining <= 0', () => {
    const a = makeAsset({ cost: 100, salvage_value: 0, useful_life_months: 10, accumulated_depreciation: 100 })
    expect(calculateMonthlyDepreciation(a)).toBe(0)
  })

  it('uses final-month remainder to prevent over-depreciation', () => {
    const a = makeAsset({ cost: 100, salvage_value: 0, useful_life_months: 12, accumulated_depreciation: 99.5 })
    // remaining = 0.5, standardMonthly = 8.3333..., should return remaining rounded
    expect(calculateMonthlyDepreciation(a)).toBe(0.5)
  })

  it('property: amount = min((C-S)/L, remaining) with 4dp rounding', () => {
    // property-ish randomized test, no extra deps
    for (let i = 0; i < 500; i++) {
      const cost = Math.round(Math.random() * 1_000_000) / 100 // up to 10k with cents
      const salvage = Math.round(Math.random() * cost) / 100
      const life = Math.max(1, Math.floor(Math.random() * 240) + 1)
      const totalDepreciable = cost - salvage
      const acc = Math.round(Math.random() * (totalDepreciable + 1000)) / 100 // allow fully-depr + extra

      const asset = makeAsset({
        cost,
        salvage_value: salvage,
        useful_life_months: life,
        accumulated_depreciation: acc,
      })

      const remaining = totalDepreciable - acc
      const standard = totalDepreciable / life
      const expected = remaining <= 0 ? 0 : round4(Math.min(standard, remaining))

      const got = calculateMonthlyDepreciation(asset)
      expect(got).toBe(expected)
    }
  })
})

