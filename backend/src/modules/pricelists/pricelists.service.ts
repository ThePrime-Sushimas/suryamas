import { pricelistsRepository } from './pricelists.repository'
import { recipesRepository } from '../food-production/recipes/recipes.repository'
import { Pricelist, PricelistWithRelations, CreatePricelistDto, UpdatePricelistDto, PricelistListQuery, PricelistApprovalDto, PricelistLookup } from './pricelists.types'
import { 
  PricelistNotFoundError, 
  DuplicateActivePricelistError, 
  InvalidDateRangeError,
  PricelistNotDraftError,
  DuplicateRestoreError
} from './pricelists.errors'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'
import { AuditService } from '../monitoring/monitoring.service'

export class PricelistsService {
  async createPricelist(data: CreatePricelistDto, userId?: string): Promise<Pricelist> {
    if (data.valid_to && new Date(data.valid_to) < new Date(data.valid_from)) {
      throw new InvalidDateRangeError()
    }

    // Auto-deactivate existing active pricelist for same combo
    const existing = await pricelistsRepository.findActiveDuplicate(
      data.company_id,
      data.supplier_id,
      data.product_id,
      data.uom_id
    )

    if (existing) {
      await pricelistsRepository.deactivate(existing.id, userId)
      if (userId) {
        await AuditService.log('UPDATE', 'pricelist', existing.id, userId, { is_active: true }, { is_active: false })
      }
    }

    const pricelist = await pricelistsRepository.create({
      ...data,
      created_by: userId,
    } as CreatePricelistDto & { created_by?: string })

    // Audit log for CREATE
    if (userId) {
      await AuditService.log('CREATE', 'pricelist', pricelist.id, userId, null, pricelist)
    }

    // Auto-update average_cost and UOM base_prices (pricelist is created as APPROVED)
    if (pricelist.status === 'APPROVED') {
      await this.updateProductAverageCost(pricelist.product_id, pricelist.company_id)
      await this.updateUomBasePrices(pricelist.product_id)
    }

    return pricelist
  }

  async updatePricelist(id: string, data: UpdatePricelistDto, userId?: string): Promise<Pricelist> {
    const existing = await pricelistsRepository.findById(id)
    if (!existing) {
      throw new PricelistNotFoundError(id)
    }

    if (existing.status !== 'DRAFT') {
      throw new PricelistNotDraftError()
    }

    if (data.valid_from || data.valid_to) {
      const validFrom = data.valid_from || existing.valid_from
      const validTo = data.valid_to || existing.valid_to
      
      if (validTo && new Date(validTo) < new Date(validFrom)) {
        throw new InvalidDateRangeError()
      }
    }

    const updated = await pricelistsRepository.updateById(id, {
      ...data,
      updated_by: userId,
    } as UpdatePricelistDto & { updated_by?: string })

    if (!updated) {
      throw new PricelistNotFoundError(id)
    }

    // Audit log for UPDATE
    if (userId) {
      await AuditService.log('UPDATE', 'pricelist', id, userId, existing, updated)
    }

    return updated
  }

  async deletePricelist(id: string, userId?: string): Promise<void> {
    const pricelist = await pricelistsRepository.findById(id)
    if (!pricelist) {
      throw new PricelistNotFoundError(id)
    }

    await pricelistsRepository.softDelete(id)

    // Audit log for DELETE
    if (userId) {
      await AuditService.log('DELETE', 'pricelist', id, userId, pricelist, null)
    }
  }

  async getPricelistById(id: string): Promise<PricelistWithRelations> {
    const pricelist = await pricelistsRepository.findById(id)
    if (!pricelist) {
      throw new PricelistNotFoundError(id)
    }
    return pricelist
  }

  async getPricelists(query: PricelistListQuery) {
    const { page, limit, offset } = getPaginationParams({ ...query })
    const { data, total } = await pricelistsRepository.findAll({ limit, offset }, query)
    
    return createPaginatedResponse(data, total, page, limit)
  }

  async approvePricelist(id: string, approval: PricelistApprovalDto, userId?: string): Promise<Pricelist> {
    const existing = await pricelistsRepository.findById(id)
    if (!existing) {
      throw new PricelistNotFoundError(id)
    }

    if (existing.status !== 'DRAFT') {
      throw new PricelistNotDraftError()
    }

    const updated = await pricelistsRepository.updateStatus(
      id,
      approval.status
    )

    if (!updated) {
      throw new PricelistNotFoundError(id)
    }

    // Audit log for UPDATE (status change)
    if (userId) {
      await AuditService.log('UPDATE', 'pricelist', id, userId, 
        { status: existing.status }, 
        { status: approval.status }
      )
    }

    // Auto-update products.average_cost and product_uoms.base_price from latest approved pricelist
    if (approval.status === 'APPROVED') {
      await this.updateProductAverageCost(updated.product_id, updated.company_id)
      await this.updateUomBasePrices(updated.product_id)
    }

    return updated
  }

  async restorePricelist(id: string, userId?: string): Promise<Pricelist> {
    try {
      const pricelist = await pricelistsRepository.restorePricelist(id)
      
      // Audit log for RESTORE
      if (userId) {
        await AuditService.log('RESTORE', 'pricelist', id, userId, null, pricelist)
      }
      
      return pricelist
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('active pricelist already exists') || msg.includes('unique constraint') || msg.includes('duplicate key')) {
        throw new DuplicateRestoreError()
      }
      throw error
    }
  }

  async lookupPrice(lookup: PricelistLookup): Promise<Pricelist | null> {
    return pricelistsRepository.lookupPrice(lookup)
  }

  async expireOldPricelists(): Promise<number> {
    return pricelistsRepository.expireOldPricelists()
  }

  /**
   * Update products.average_cost from the latest APPROVED pricelist,
   * then propagate to wip_ingredients → wip_items → recipe_lines → menus.
   */
  async updateProductAverageCost(productId: string, companyId: string): Promise<void> {
    const costPerBaseUnit = await pricelistsRepository.getLatestCostPerBaseUnit(productId)
    if (costPerBaseUnit === null) return
    await pricelistsRepository.updateProductAverageCost(productId, costPerBaseUnit)
    // Propagate cost change to recipe/WIP/menus
    await recipesRepository.recalculateCostFromProduct(productId, companyId)
  }

  /**
   * Update product_uoms.base_price for all UOMs of a product
   * based on the latest approved pricelist cost per base unit.
   * base_price = cost_per_base_unit × conversion_factor
   */
  async updateUomBasePrices(productId: string): Promise<void> {
    const costPerBaseUnit = await pricelistsRepository.getLatestCostPerBaseUnit(productId)
    if (costPerBaseUnit === null) return
    await pricelistsRepository.updateAllUomBasePrices(productId, costPerBaseUnit)
  }
}

export const pricelistsService = new PricelistsService()

