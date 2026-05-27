import type { PoolClient } from 'pg'
import { pricelistsRepository } from './pricelists.repository'
import { recipesRepository } from '../food-production/recipes/recipes.repository'
import {
  Pricelist,
  PricelistWithRelations,
  CreatePricelistDto,
  UpdatePricelistDto,
  PricelistListQuery,
  PricelistApprovalDto,
  PricelistLookup,
  PricelistSyncResult,
  PiLineForPricelistSync,
  PriceChangeListQuery,
  PriceChangeChartQuery,
} from './pricelists.types'
import { 
  PricelistNotFoundError, 
  DuplicateActivePricelistError, 
  InvalidDateRangeError,
  PricelistNotDraftError,
  DuplicateRestoreError,
} from './pricelists.errors'
import { PurchaseInvoicePricelistSupersededError } from '../purchase-invoices/purchase-invoices.errors'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'
import { AuditService } from '../monitoring/monitoring.service'
import { pricesNearlyEqual } from './pricelists.utils'

export class PricelistsService {
  async createPricelist(data: CreatePricelistDto, userId?: string): Promise<Pricelist> {
    if (data.valid_to && new Date(data.valid_to) < new Date(data.valid_from)) {
      throw new InvalidDateRangeError()
    }

    // Auto-deactivate existing active pricelist for same combo.
    // Known limitation: no row lock — concurrent manual creates may share the same old_price
    // in history. PI post uses FOR UPDATE via syncFromPurchaseInvoice; manual path is rare.
    const existing = await pricelistsRepository.findActiveDuplicate(
      data.company_id,
      data.supplier_id,
      data.product_id,
      data.uom_id
    )
    const oldPrice = existing ? Number(existing.price) : null

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

    await pricelistsRepository.insertPriceChange({
      company_id: data.company_id,
      supplier_id: data.supplier_id,
      product_id: data.product_id,
      uom_id: data.uom_id,
      old_price: oldPrice,
      new_price: data.price,
      effective_date: data.valid_from,
      source: 'MANUAL',
      pricelist_id: pricelist.id,
      created_by: userId ?? null,
    })

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

    if (approval.status === 'APPROVED') {
      const productName = await pricelistsRepository.getProductName(updated.product_id)
      await notificationDispatcher.dispatch(
        NOTIFICATION_EVENT_KEYS.PRICELIST_APPROVED,
        updated.company_id,
        {
          entityId: id,
          variables: { product_label: productName },
          excludeUserIds: userId ? [userId] : [],
        }
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

  async batchLookupBySupplier(
    supplierId: string,
    productIds: string[],
  ): Promise<Record<string, { price: number; uom_name: string; conversion_factor: number }>> {
    const map = await pricelistsRepository.batchLookupBySupplier(supplierId, productIds)
    return Object.fromEntries(map)
  }

  async expireOldPricelists(): Promise<number> {
    return pricelistsRepository.expireOldPricelists()
  }

  /**
   * Update products.average_cost from the latest APPROVED pricelist,
   * then propagate to wip_ingredients → wip_items → recipe_lines → menus.
   */
  /**
   * Updates products.average_cost from latest active pricelist, then propagates to recipes.
   *
   * When `client` is passed (inside a DB transaction), recipe propagation is intentionally
   * skipped — callers must run recipesRepository.recalculateCostFromProduct after COMMIT
   * (e.g. purchase-invoices recalculateRecipesAfterPricelistChange). Without `client`, recipe
   * recalc runs inline (manual pricelist create/approve paths).
   */
  async updateProductAverageCost(productId: string, companyId: string, client?: PoolClient): Promise<void> {
    const costPerBaseUnit = await pricelistsRepository.getLatestCostPerBaseUnit(productId, client)
    if (costPerBaseUnit === null) return
    await pricelistsRepository.updateProductAverageCost(productId, costPerBaseUnit, client)
    if (!client) {
      await recipesRepository.recalculateCostFromProduct(productId, companyId)
    }
  }

  /**
   * Update product_uoms.base_price for all UOMs of a product
   * based on the latest approved pricelist cost per base unit.
   * base_price = cost_per_base_unit × conversion_factor
   */
  async updateUomBasePrices(productId: string, client?: PoolClient): Promise<void> {
    const costPerBaseUnit = await pricelistsRepository.getLatestCostPerBaseUnit(productId, client)
    if (costPerBaseUnit === null) return
    await pricelistsRepository.updateAllUomBasePrices(productId, costPerBaseUnit, client)
  }

  async syncFromPurchaseInvoice(input: {
    client: PoolClient
    companyId: string
    supplierId: string
    productId: string
    uomId: string
    unitPrice: number
    invoiceDate: string
    purchaseInvoiceId: string
    purchaseInvoiceLineId: string
    userId?: string
  }): Promise<{ synced: boolean; skipped: boolean }> {
    const active = await pricelistsRepository.findActiveForUpdate(
      input.client,
      input.companyId,
      input.supplierId,
      input.productId,
      input.uomId,
    )
    const oldPrice = active?.price ?? null

    if (oldPrice != null && pricesNearlyEqual(oldPrice, input.unitPrice)) {
      return { synced: false, skipped: true }
    }

    if (active) {
      await pricelistsRepository.deactivateWithValidTo(
        input.client,
        active.id,
        input.invoiceDate,
        input.userId,
      )
    }

    const pricelist = await pricelistsRepository.createInTransaction(input.client, {
      company_id: input.companyId,
      supplier_id: input.supplierId,
      product_id: input.productId,
      uom_id: input.uomId,
      price: input.unitPrice,
      valid_from: input.invoiceDate,
      valid_to: null,
      is_active: true,
      source: 'PI_POST',
      purchase_invoice_id: input.purchaseInvoiceId,
      created_by: input.userId,
    })

    await pricelistsRepository.insertPriceChange({
      company_id: input.companyId,
      supplier_id: input.supplierId,
      product_id: input.productId,
      uom_id: input.uomId,
      old_price: oldPrice,
      new_price: input.unitPrice,
      effective_date: input.invoiceDate,
      source: 'PI_POST',
      purchase_invoice_id: input.purchaseInvoiceId,
      purchase_invoice_line_id: input.purchaseInvoiceLineId,
      pricelist_id: pricelist.id,
      created_by: input.userId ?? null,
    }, input.client)

    return { synced: true, skipped: false }
  }

  async syncAllFromPostedPurchaseInvoice(input: {
    client: PoolClient
    companyId: string
    supplierId: string
    invoiceId: string
    invoiceDate: string
    userId?: string
    lines: PiLineForPricelistSync[]
  }): Promise<{ result: PricelistSyncResult; affectedProductIds: string[] }> {
    const result: PricelistSyncResult = { synced: 0, skipped: 0, warnings: [] }
    const affectedProductIds = new Set<string>()

    for (const line of input.lines) {
      if (!line.uom_invoice?.trim()) {
        result.warnings.push({
          product_name: line.product_name,
          uom_invoice: line.uom_invoice || '—',
          reason: 'UOM invoice tidak terdefinisi',
        })
        continue
      }

      if (!line.uom_id) {
        result.warnings.push({
          product_name: line.product_name,
          uom_invoice: line.uom_invoice,
          reason: `UOM "${line.uom_invoice}" tidak ditemukan di master produk`,
        })
        continue
      }

      if (Math.abs(line.unit_price) < 0.000001) {
        result.skipped++
        continue
      }

      const syncOutcome = await this.syncFromPurchaseInvoice({
        client: input.client,
        companyId: input.companyId,
        supplierId: input.supplierId,
        productId: line.product_id,
        uomId: line.uom_id,
        unitPrice: line.unit_price,
        invoiceDate: input.invoiceDate,
        purchaseInvoiceId: input.invoiceId,
        purchaseInvoiceLineId: line.id,
        userId: input.userId,
      })

      if (syncOutcome.skipped) {
        result.skipped++
      } else if (syncOutcome.synced) {
        result.synced++
        affectedProductIds.add(line.product_id)
      }
    }

    for (const productId of affectedProductIds) {
      await this.updateProductAverageCost(productId, input.companyId, input.client)
      await this.updateUomBasePrices(productId, input.client)
    }

    return { result, affectedProductIds: [...affectedProductIds] }
  }

  async revertPricelistOnPurchaseInvoiceUnpost(input: {
    client: PoolClient
    companyId: string
    invoiceId: string
    invoiceDate: string
    userId?: string
  }): Promise<string[]> {
    const blocked = await pricelistsRepository.findUnpostBlockedItems(
      input.client,
      input.invoiceId,
      input.companyId,
    )
    if (blocked.length > 0) {
      throw new PurchaseInvoicePricelistSupersededError(blocked)
    }

    const changes = await pricelistsRepository.findPiPostChangesForRevert(
      input.client,
      input.invoiceId,
      input.companyId,
    )
    const affectedProductIds = new Set<string>()

    for (const change of changes) {
      const active = await pricelistsRepository.findByIdForUpdate(input.client, change.pricelist_id)
      if (!active || !active.is_active) {
        throw new PurchaseInvoicePricelistSupersededError([
          {
            product_name: change.product_name,
            uom_name: change.uom_name,
            superseding_invoice_number: null,
          },
        ])
      }

      await pricelistsRepository.deactivateWithValidTo(
        input.client,
        change.pricelist_id,
        input.invoiceDate,
        input.userId,
      )

      if (change.old_price != null) {
        const restored = await pricelistsRepository.createInTransaction(input.client, {
          company_id: input.companyId,
          supplier_id: change.supplier_id,
          product_id: change.product_id,
          uom_id: change.uom_id,
          price: change.old_price,
          valid_from: input.invoiceDate,
          valid_to: null,
          is_active: true,
          source: 'PI_UNPOST',
          purchase_invoice_id: input.invoiceId,
          created_by: input.userId,
        })

        await pricelistsRepository.insertPriceChange({
          company_id: input.companyId,
          supplier_id: change.supplier_id,
          product_id: change.product_id,
          uom_id: change.uom_id,
          old_price: change.new_price,
          new_price: change.old_price,
          effective_date: input.invoiceDate,
          source: 'PI_UNPOST',
          purchase_invoice_id: input.invoiceId,
          pricelist_id: restored.id,
          created_by: input.userId ?? null,
        }, input.client)
      } else {
        // First-ever price for combo — pricelist deactivated, no restore row.
      }

      affectedProductIds.add(change.product_id)
    }

    for (const productId of affectedProductIds) {
      await this.updateProductAverageCost(productId, input.companyId, input.client)
      await this.updateUomBasePrices(productId, input.client)
    }

    return [...affectedProductIds]
  }

  async getPriceChanges(companyIds: string[], query: PriceChangeListQuery) {
    const { page, limit, offset } = getPaginationParams({ ...query })
    const [{ data, total }, summary] = await Promise.all([
      pricelistsRepository.findPriceChanges(companyIds, { limit, offset }, query),
      pricelistsRepository.summarizePriceChanges(companyIds, query),
    ])
    return {
      ...createPaginatedResponse(data, total, page, limit),
      summary,
    }
  }

  async getPriceChangeChart(companyIds: string[], query: PriceChangeChartQuery) {
    return pricelistsRepository.findPriceChangeChart(companyIds, query)
  }
}

export const pricelistsService = new PricelistsService()

