import { ProductsRepository, productsRepository } from './products.repository'
import { Product, CreateProductDto, UpdateProductDto, ProductStatus } from './products.types'
import { AuditService } from '../monitoring/monitoring.service'
import { logError, logInfo } from '../../config/logger'
import {
  ProductNotFoundError,
  DuplicateProductCodeError,
  DuplicateProductNameError,
  InvalidProductStatusError,
  ProductCodeUpdateError,
  BulkOperationLimitError,
  ProductValidationError,
} from './products.errors'
import { VALID_PRODUCT_STATUSES, VALID_PRODUCT_TYPES, PRODUCT_DEFAULTS, PRODUCT_LIMITS } from './products.constants'
import { calculatePagination, calculateOffset } from '../../utils/pagination.util'
import { productUomsRepository } from '../product-uoms/product-uoms.repository'
import { resolveUserStationAccess } from './products.access'

export class ProductsService {
  constructor(
    private repository: ProductsRepository = productsRepository,
    private auditService: typeof AuditService = AuditService
  ) {}

  async list(
    pagination: { page: number; limit: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: Record<string, unknown>,
    includeDeleted = false,
    userId?: string
  ) {
    const offset = calculateOffset(pagination.page, pagination.limit)
    const stationAccess = userId ? await resolveUserStationAccess(userId) : undefined
    const enrichedFilter = stationAccess && !stationAccess.canAccessAll
      ? { ...filter, allowed_stations: stationAccess.stationCodes }
      : filter

    const { data, total } = await this.repository.findAll(
      { limit: pagination.limit, offset },
      sort,
      enrichedFilter,
      includeDeleted
    )

    return {
      data,
      pagination: calculatePagination(pagination, total),
    }
  }

  async search(
    q: string,
    pagination: { page: number; limit: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: Record<string, unknown>,
    includeDeleted = false,
    userId?: string
  ) {
    const offset = calculateOffset(pagination.page, pagination.limit)
    const stationAccess = userId ? await resolveUserStationAccess(userId) : undefined
    const enrichedFilter = stationAccess && !stationAccess.canAccessAll
      ? { ...filter, allowed_stations: stationAccess.stationCodes }
      : filter

    const { data, total } = await this.repository.search(
      q,
      { limit: pagination.limit, offset },
      sort,
      enrichedFilter,
      includeDeleted
    )

    return {
      data,
      pagination: calculatePagination(pagination, total),
    }
  }

  async create(dto: CreateProductDto & { base_unit_id?: string }, userId?: string): Promise<Product> {
    if (dto.status && !VALID_PRODUCT_STATUSES.includes(dto.status)) {
      throw new InvalidProductStatusError(dto.status, VALID_PRODUCT_STATUSES)
    }

    if (dto.product_code) {
      const existing = await this.repository.findByProductCode(dto.product_code)
      if (existing) {
        throw new DuplicateProductCodeError(dto.product_code)
      }
    }

    const existingName = await this.repository.findByProductName(dto.product_name)
    if (existingName) {
      throw new DuplicateProductNameError(dto.product_name)
    }

    const { base_unit_id, ...productDto } = dto

    // Validate: if is_asset=true, asset_category_id is required
    if (productDto.is_asset && !productDto.asset_category_id) {
      throw new ProductValidationError('asset_category_id is required when is_asset is true')
    }

    const data = {
      ...productDto,
      status: productDto.status || PRODUCT_DEFAULTS.STATUS,
      product_type: productDto.product_type || PRODUCT_DEFAULTS.PRODUCT_TYPE,
      average_cost: productDto.average_cost || PRODUCT_DEFAULTS.AVERAGE_COST,
      is_requestable: productDto.is_requestable ?? PRODUCT_DEFAULTS.IS_REQUESTABLE,
      is_purchasable: productDto.is_purchasable ?? PRODUCT_DEFAULTS.IS_PURCHASABLE,
      is_asset: productDto.is_asset ?? PRODUCT_DEFAULTS.IS_ASSET,
      created_by: userId,
      updated_by: userId,
    }

    const product = await this.repository.create(data)

    // Auto-create base UOM if base_unit_id provided
    if (base_unit_id) {
      await productUomsRepository.create({
        product_id: product.id,
        metric_unit_id: base_unit_id,
        conversion_factor: 1,
        is_base_unit: true,
        is_default_stock_unit: true,
        is_default_purchase_unit: true,
        is_default_transfer_unit: true,
        created_by: userId,
        updated_by: userId,
      })
    }

    if (userId) {
      await this.auditService.log('CREATE', 'product', product.id, userId, undefined, product)
    }

    logInfo('Product created', { id: product.id, code: product.product_code, userId })
    return product
  }

  async update(id: string, dto: UpdateProductDto, userId?: string): Promise<Product> {
    if ('product_code' in dto) {
      throw new ProductCodeUpdateError()
    }

    if (dto.status && !VALID_PRODUCT_STATUSES.includes(dto.status)) {
      throw new InvalidProductStatusError(dto.status, VALID_PRODUCT_STATUSES)
    }

    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new ProductNotFoundError(id)
    }

    if (dto.product_name) {
      const existingName = await this.repository.findByProductName(dto.product_name, id)
      if (existingName) {
        throw new DuplicateProductNameError(dto.product_name)
      }
    }

    // Validate: if is_asset=true, asset_category_id must be provided (or already set)
    const willBeAsset = dto.is_asset ?? existing.is_asset
    const willHaveCategory = dto.asset_category_id !== undefined ? dto.asset_category_id : existing.asset_category_id
    if (willBeAsset && !willHaveCategory) {
      throw new ProductValidationError('asset_category_id is required when is_asset is true')
    }

    const data = { ...dto, updated_by: userId }
    const product = await this.repository.updateById(id, data)

    if (product && userId) {
      await this.auditService.log('UPDATE', 'product', id, userId, existing, dto)
    }

    logInfo('Product updated', { id, userId })
    return product!
  }

  async findById(id: string, includeDeleted = false): Promise<Product> {
    const product = await this.repository.findById(id, includeDeleted)
    if (!product) {
      throw new ProductNotFoundError(id)
    }
    return product
  }

  async delete(id: string, userId?: string): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new ProductNotFoundError(id)
    }

    await this.repository.delete(id)

    if (userId) {
      await this.auditService.log('DELETE', 'product', id, userId, existing)
    }

    logInfo('Product deleted', { id, userId })
  }

  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    if (ids.length > PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) {
      throw new BulkOperationLimitError(PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE)
    }

    await this.repository.bulkDelete(ids)

    if (userId) {
      await this.auditService.log('DELETE', 'product', ids.join(','), userId)
    }

    logInfo('Bulk delete products', { count: ids.length, userId })
  }

  async bulkUpdateStatus(ids: string[], status: ProductStatus, userId?: string): Promise<void> {
    if (!VALID_PRODUCT_STATUSES.includes(status)) {
      throw new InvalidProductStatusError(status, VALID_PRODUCT_STATUSES)
    }

    if (ids.length > PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) {
      throw new BulkOperationLimitError(PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE)
    }

    await this.repository.bulkUpdateStatus(ids, status)

    if (userId) {
      await this.auditService.log('UPDATE', 'product', ids.join(','), userId, undefined, { status })
    }

    logInfo('Bulk status update', { count: ids.length, status, userId })
  }

  async getFilterOptions() {
    return this.repository.getFilterOptions()
  }

  async minimalActive(userId?: string): Promise<{ id: string; product_name: string }[]> {
    const stationAccess = userId ? await resolveUserStationAccess(userId) : undefined
    const allowedStations = stationAccess && !stationAccess.canAccessAll
      ? stationAccess.stationCodes
      : undefined
    return this.repository.minimalActive(allowedStations)
  }

  async checkProductNameExists(productName: string, excludeId?: string): Promise<boolean> {
    const existing = await this.repository.findByProductName(productName, excludeId)
    return !!existing
  }

  async restore(id: string, userId?: string): Promise<Product> {
    const existing = await this.repository.findById(id, true)
    if (!existing) {
      throw new ProductNotFoundError(id)
    }

    const product = await this.repository.updateById(id, { is_deleted: false, updated_by: userId })
    
    if (userId) {
      await this.auditService.log('RESTORE', 'product', id, userId, existing)
    }
    
    logInfo('Product restored', { id, userId })
    return product!
  }

  async bulkRestore(ids: string[], userId?: string): Promise<void> {
    if (ids.length > PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) {
      throw new BulkOperationLimitError(PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE)
    }

    await this.repository.bulkRestore(ids)

    if (userId) {
      await this.auditService.log('RESTORE', 'product', ids.join(','), userId)
    }

    logInfo('Bulk restore products', { count: ids.length, userId })
  }
  async batchFlags(ids: string[]): Promise<Record<string, { requires_processing: boolean }>> {
    return productsRepository.batchFlags(ids)
  }
}

export const productsService = new ProductsService()
