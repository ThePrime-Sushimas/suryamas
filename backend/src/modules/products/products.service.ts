import { ProductsRepository, productsRepository } from './products.repository'
import { Product, CreateProductDto, UpdateProductDto, ProductStatus } from './products.types'
import { AuditService } from '../../services/audit.service'
import { logError, logInfo } from '../../config/logger'
import {
  ProductNotFoundError,
  DuplicateProductCodeError,
  DuplicateProductNameError,
  InvalidProductStatusError,
  ProductCodeUpdateError,
  BulkOperationLimitError,
} from './products.errors'
import { VALID_PRODUCT_STATUSES, VALID_PRODUCT_TYPES, PRODUCT_DEFAULTS, PRODUCT_LIMITS } from './products.constants'
import { calculatePagination, calculateOffset } from '../../utils/pagination.util'

export class ProductsService {
  constructor(
    private repository: ProductsRepository = productsRepository,
    private auditService: typeof AuditService = AuditService
  ) {}

  async list(
    pagination: { page: number; limit: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    includeDeleted = false
  ) {
    const offset = calculateOffset(pagination.page, pagination.limit)
    const { data, total } = await this.repository.findAll(
      { limit: pagination.limit, offset },
      sort,
      filter,
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
    filter?: any,
    includeDeleted = false
  ) {
    const offset = calculateOffset(pagination.page, pagination.limit)
    const { data, total } = await this.repository.search(
      q,
      { limit: pagination.limit, offset },
      sort,
      filter,
      includeDeleted
    )

    return {
      data,
      pagination: calculatePagination(pagination, total),
    }
  }

  async create(dto: CreateProductDto, userId?: string): Promise<Product> {
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

    const data = {
      ...dto,
      status: dto.status || PRODUCT_DEFAULTS.STATUS,
      product_type: dto.product_type || PRODUCT_DEFAULTS.PRODUCT_TYPE,
      average_cost: dto.average_cost || PRODUCT_DEFAULTS.AVERAGE_COST,
      is_requestable: dto.is_requestable ?? PRODUCT_DEFAULTS.IS_REQUESTABLE,
      is_purchasable: dto.is_purchasable ?? PRODUCT_DEFAULTS.IS_PURCHASABLE,
      created_by: userId,
      updated_by: userId,
    }

    const product = await this.repository.create(data)

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

  async minimalActive(): Promise<{ id: string; product_name: string }[]> {
    return this.repository.minimalActive()
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
}

export const productsService = new ProductsService()
