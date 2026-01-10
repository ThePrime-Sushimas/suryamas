import { pricelistsRepository } from './pricelists.repository'
import { Pricelist, PricelistWithRelations, CreatePricelistDto, UpdatePricelistDto, PricelistListQuery, PricelistApprovalDto, PricelistLookup } from './pricelists.types'
import { 
  PricelistNotFoundError, 
  DuplicateActivePricelistError, 
  InvalidDateRangeError,
  PricelistNotDraftError 
} from './pricelists.errors'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'

export class PricelistsService {
  async createPricelist(data: CreatePricelistDto, userId?: string): Promise<Pricelist> {
    if (data.valid_to && new Date(data.valid_to) < new Date(data.valid_from)) {
      throw new InvalidDateRangeError()
    }

    const duplicate = await pricelistsRepository.findActiveDuplicate(
      data.company_id,
      data.supplier_id,
      data.product_id,
      data.uom_id
    )

    if (duplicate) {
      throw new DuplicateActivePricelistError()
    }

    return pricelistsRepository.create({
      ...data,
      created_by: userId,
    })
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
    })

    if (!updated) {
      throw new PricelistNotFoundError(id)
    }

    return updated
  }

  async deletePricelist(id: string, userId?: string): Promise<void> {
    const pricelist = await pricelistsRepository.findById(id)
    if (!pricelist) {
      throw new PricelistNotFoundError(id)
    }

    await pricelistsRepository.softDelete(id, userId)
  }

  async getPricelistById(id: string): Promise<PricelistWithRelations> {
    const pricelist = await pricelistsRepository.findById(id)
    if (!pricelist) {
      throw new PricelistNotFoundError(id)
    }
    return pricelist
  }

  async getPricelists(query: PricelistListQuery) {
    const { page, limit, offset } = getPaginationParams(query as any)
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
      approval.status,
      approval.status === 'APPROVED' ? userId : undefined
    )

    if (!updated) {
      throw new PricelistNotFoundError(id)
    }

    return updated
  }

  async lookupPrice(lookup: PricelistLookup): Promise<Pricelist | null> {
    return pricelistsRepository.lookupPrice(lookup)
  }

  async expireOldPricelists(): Promise<number> {
    return pricelistsRepository.expireOldPricelists()
  }
}

export const pricelistsService = new PricelistsService()
