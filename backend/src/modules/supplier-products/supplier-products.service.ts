import { SupplierProductsRepository, supplierProductsRepository } from './supplier-products.repository'
import { suppliersRepository } from '../suppliers/suppliers.repository'
import { productsRepository } from '../products/products.repository'
import { 
  SupplierProduct, 
  SupplierProductWithRelations, 
  CreateSupplierProductDto, 
  UpdateSupplierProductDto, 
  SupplierProductListQuery 
} from './supplier-products.types'
import {
  SupplierProductNotFoundError,
  DuplicateSupplierProductError,
  InvalidSupplierError,
  InvalidProductError,
  MaxPreferredSuppliersError,
  BulkOperationLimitError,
  InvalidCurrencyError,
} from './supplier-products.errors'
import { 
  SUPPLIER_PRODUCT_DEFAULTS, 
  SUPPLIER_PRODUCT_LIMITS, 
  VALID_CURRENCIES,
  BUSINESS_RULES 
} from './supplier-products.constants'
import { calculatePagination, calculateOffset } from '../../utils/pagination.util'
import { AuditService } from '../../services/audit.service'
import { logInfo, logError } from '../../config/logger'

export class SupplierProductsService {
  // Cache for validation results (TTL: 5 minutes)
  private supplierCache = new Map<number, { valid: boolean; timestamp: number }>()
  private productCache = new Map<string, { valid: boolean; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(
    private repository: SupplierProductsRepository = supplierProductsRepository,
    private auditService: typeof AuditService = AuditService
  ) {}

  /**
   * List supplier products with pagination and filtering
   */
  async list(
    pagination: { page: number; limit: number },
    query?: SupplierProductListQuery,
    includeRelations = false
  ) {
    const offset = calculateOffset(pagination.page, pagination.limit)
    const { data, total } = await this.repository.findAll(
      { limit: pagination.limit, offset },
      query,
      includeRelations
    )

    return {
      data,
      pagination: calculatePagination(pagination, total),
    }
  }

  /**
   * Get supplier product by ID
   */
  async findById(id: string, includeRelations = false): Promise<SupplierProduct | SupplierProductWithRelations> {
    const supplierProduct = await this.repository.findById(id, includeRelations)
    if (!supplierProduct) {
      throw new SupplierProductNotFoundError(id)
    }
    return supplierProduct
  }

  /**
   * Get supplier products by supplier ID
   */
  async findBySupplier(supplierId: number, includeRelations = false) {
    // Validate supplier exists and is active
    await this.validateSupplier(supplierId)
    
    return this.repository.findBySupplier(supplierId, includeRelations)
  }

  /**
   * Get supplier products by product ID
   */
  async findByProduct(productId: string, includeRelations = false) {
    // Validate product exists and is active
    await this.validateProduct(productId)
    
    return this.repository.findByProduct(productId, includeRelations)
  }

  /**
   * Create new supplier product
   */
  async create(dto: CreateSupplierProductDto, userId?: string): Promise<SupplierProduct> {
    // Validate supplier exists and is active
    await this.validateSupplier(dto.supplier_id)
    
    // Validate product exists and is active
    await this.validateProduct(dto.product_id)

    // Check for duplicate supplier-product combination
    const existing = await this.repository.findBySupplierAndProduct(dto.supplier_id, dto.product_id)
    if (existing) {
      throw new DuplicateSupplierProductError(dto.supplier_id, dto.product_id)
    }

    // Validate currency if provided
    if (dto.currency && !VALID_CURRENCIES.includes(dto.currency)) {
      throw new InvalidCurrencyError(dto.currency, [...VALID_CURRENCIES])
    }

    // Check preferred supplier limit
    if (dto.is_preferred) {
      await this.validatePreferredSupplierLimit(dto.product_id)
    }

    const data = {
      ...dto,
      currency: dto.currency || SUPPLIER_PRODUCT_DEFAULTS.CURRENCY,
      is_preferred: dto.is_preferred ?? SUPPLIER_PRODUCT_DEFAULTS.IS_PREFERRED,
      is_active: dto.is_active ?? SUPPLIER_PRODUCT_DEFAULTS.IS_ACTIVE,
      created_by: userId,
      updated_by: userId,
    }

    const supplierProduct = await this.repository.create(data)

    // Audit logging
    if (userId) {
      await this.auditService.log('CREATE', 'supplier_product', supplierProduct.id, userId, undefined, supplierProduct)
    }

    logInfo('Supplier product created', { 
      id: supplierProduct.id, 
      supplier_id: dto.supplier_id,
      product_id: dto.product_id,
      userId 
    })

    return supplierProduct
  }

  /**
   * Update supplier product
   */
  async update(id: string, dto: UpdateSupplierProductDto, userId?: string): Promise<SupplierProduct> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new SupplierProductNotFoundError(id)
    }

    // Validate currency if provided
    if (dto.currency && !VALID_CURRENCIES.includes(dto.currency)) {
      throw new InvalidCurrencyError(dto.currency, [...VALID_CURRENCIES])
    }

    // Check preferred supplier limit if setting to preferred
    if (dto.is_preferred && !existing.is_preferred) {
      await this.validatePreferredSupplierLimit(existing.product_id, id)
    }

    const data = { ...dto, updated_by: userId }
    const supplierProduct = await this.repository.updateById(id, data)

    if (!supplierProduct) {
      throw new SupplierProductNotFoundError(id)
    }

    // Audit logging
    if (userId) {
      await this.auditService.log('UPDATE', 'supplier_product', id, userId, existing, dto)
    }

    logInfo('Supplier product updated', { id, userId })
    return supplierProduct
  }

  /**
   * Delete supplier product
   */
  async delete(id: string, userId?: string): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new SupplierProductNotFoundError(id)
    }

    await this.repository.delete(id)

    // Audit logging
    if (userId) {
      await this.auditService.log('DELETE', 'supplier_product', id, userId, existing)
    }

    logInfo('Supplier product deleted', { id, userId })
  }

  /**
   * Bulk delete supplier products
   */
  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    if (ids.length > SUPPLIER_PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE) {
      throw new BulkOperationLimitError(SUPPLIER_PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE, ids.length)
    }

    await this.repository.bulkDelete(ids)

    // Audit logging
    if (userId) {
      await this.auditService.log('DELETE', 'supplier_product', ids.join(','), userId)
    }

    logInfo('Bulk delete supplier products', { count: ids.length, userId })
  }

  /**
   * Get active supplier products for dropdown/options
   */
  async getActiveOptions() {
    return this.repository.getActiveOptions()
  }

  /**
   * Validate supplier exists and is active with caching
   */
  private async validateSupplier(supplierId: number): Promise<void> {
    if (!BUSINESS_RULES.REQUIRE_ACTIVE_SUPPLIER) return

    // Check cache first
    const cached = this.supplierCache.get(supplierId)
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      if (!cached.valid) {
        throw new InvalidSupplierError(supplierId, 'not_found')
      }
      return
    }

    try {
      const supplier = await suppliersRepository.findById(supplierId)
      if (!supplier) {
        this.supplierCache.set(supplierId, { valid: false, timestamp: Date.now() })
        throw new InvalidSupplierError(supplierId, 'not_found')
      }
      if (!supplier.is_active) {
        this.supplierCache.set(supplierId, { valid: false, timestamp: Date.now() })
        throw new InvalidSupplierError(supplierId, 'inactive')
      }
      if (supplier.deleted_at) {
        this.supplierCache.set(supplierId, { valid: false, timestamp: Date.now() })
        throw new InvalidSupplierError(supplierId, 'deleted')
      }
      
      // Cache valid result
      this.supplierCache.set(supplierId, { valid: true, timestamp: Date.now() })
    } catch (error) {
      if (error instanceof InvalidSupplierError) {
        throw error
      }
      logError('Error validating supplier', { supplierId, error: error instanceof Error ? error.message : 'Unknown error' })
      this.supplierCache.set(supplierId, { valid: false, timestamp: Date.now() })
      throw new InvalidSupplierError(supplierId, 'not_found')
    }
  }

  /**
   * Validate product exists and is active with caching
   */
  private async validateProduct(productId: string): Promise<void> {
    if (!BUSINESS_RULES.REQUIRE_ACTIVE_PRODUCT) return

    // Check cache first
    const cached = this.productCache.get(productId)
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      if (!cached.valid) {
        throw new InvalidProductError(productId, 'not_found')
      }
      return
    }

    try {
      const product = await productsRepository.findById(productId)
      if (!product) {
        this.productCache.set(productId, { valid: false, timestamp: Date.now() })
        throw new InvalidProductError(productId, 'not_found')
      }
      if (product.status !== 'ACTIVE') {
        this.productCache.set(productId, { valid: false, timestamp: Date.now() })
        throw new InvalidProductError(productId, 'inactive')
      }
      if (product.is_deleted) {
        this.productCache.set(productId, { valid: false, timestamp: Date.now() })
        throw new InvalidProductError(productId, 'deleted')
      }
      
      // Cache valid result
      this.productCache.set(productId, { valid: true, timestamp: Date.now() })
    } catch (error) {
      if (error instanceof InvalidProductError) {
        throw error
      }
      logError('Error validating product', { productId, error: error instanceof Error ? error.message : 'Unknown error' })
      this.productCache.set(productId, { valid: false, timestamp: Date.now() })
      throw new InvalidProductError(productId, 'not_found')
    }
  }

  /**
   * Validate preferred supplier limit for a product
   */
  private async validatePreferredSupplierLimit(productId: string, excludeId?: string): Promise<void> {
    const preferredCount = await this.repository.countPreferredByProduct(productId, excludeId)
    if (preferredCount >= BUSINESS_RULES.MAX_PREFERRED_SUPPLIERS_PER_PRODUCT) {
      throw new MaxPreferredSuppliersError(productId, BUSINESS_RULES.MAX_PREFERRED_SUPPLIERS_PER_PRODUCT)
    }
  }
}

export const supplierProductsService = new SupplierProductsService()