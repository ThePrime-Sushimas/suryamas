import { productsRepository } from './products.repository'
import { Product, ProductUom, CreateProductDto, UpdateProductDto, CreateProductUomDto, UpdateProductUomDto, ProductStatus, UomStatus } from '../../types/product.types'
import { AuditService } from '../../services/audit.service'
import { logError, logInfo } from '../../config/logger'

const VALID_STATUSES: ProductStatus[] = ['ACTIVE', 'INACTIVE', 'DISCONTINUED']
const VALID_UOM_STATUSES: UomStatus[] = ['ACTIVE', 'INACTIVE']

export class ProductsService {
  async list(
    pagination: { page: number; limit: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    includeDeleted = false
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await productsRepository.findAll(
      { limit: pagination.limit, offset },
      sort,
      filter,
      includeDeleted
    )

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page < Math.ceil(total / pagination.limit),
        hasPrev: pagination.page > 1,
      },
    }
  }

  async search(
    q: string,
    pagination: { page: number; limit: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    includeDeleted = false
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await productsRepository.search(q, { limit: pagination.limit, offset }, sort, filter, includeDeleted)

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page < Math.ceil(total / pagination.limit),
        hasPrev: pagination.page > 1,
      },
    }
  }

  async create(dto: CreateProductDto, userId?: string): Promise<Product> {
    if (!dto.product_name || !dto.category_id || !dto.sub_category_id) {
      throw new Error('Missing required fields: product_name, category_id, sub_category_id')
    }

    if (dto.status && !VALID_STATUSES.includes(dto.status)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    if (dto.product_code) {
      const existing = await productsRepository.findByProductCode(dto.product_code)
      if (existing) {
        throw new Error('Product code already exists')
      }
    }

    const existingName = await productsRepository.findByProductName(dto.product_name)
    if (existingName) {
      throw new Error('Product name already exists')
    }

    const data: any = {
      ...dto,
      status: dto.status || 'ACTIVE',
      is_requestable: dto.is_requestable ?? true,
      is_purchasable: dto.is_purchasable ?? true,
      created_by: userId,
      updated_by: userId,
    }

    const product = await productsRepository.create(data)

    if (userId) {
      await AuditService.log('CREATE', 'product', product.id, userId, undefined, product)
    }

    logInfo('Product created', { id: product.id, code: product.product_code })
    return product
  }

  async update(id: string, dto: UpdateProductDto, userId?: string): Promise<Product | null> {
    if ('product_code' in dto) {
      throw new Error('Product code cannot be updated')
    }

    if (dto.status && !VALID_STATUSES.includes(dto.status)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    if (dto.product_name) {
      const existingName = await productsRepository.findByProductName(dto.product_name, id)
      if (existingName) {
        throw new Error('Product name already exists')
      }
    }

    const data: any = { ...dto, updated_by: userId }
    const product = await productsRepository.updateById(id, data)

    if (product && userId) {
      await AuditService.log('UPDATE', 'product', id, userId, undefined, dto)
    }

    logInfo('Product updated', { id })
    return product
  }

  async getById(id: string, includeDeleted = false): Promise<Product | null> {
    return productsRepository.getById(id, includeDeleted)
  }

  async delete(id: string, userId?: string): Promise<void> {
    try {
      await productsRepository.delete(id)

      if (userId) {
        await AuditService.log('DELETE', 'product', id, userId)
      }

      logInfo('Product deleted', { id })
    } catch (error: any) {
      logError('Delete product failed', { id, error: error.message })
      throw error
    }
  }

  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    try {
      await productsRepository.bulkDelete(ids)

      if (userId) {
        await AuditService.log('DELETE', 'product', ids.join(','), userId)
      }

      logInfo('Bulk delete products', { count: ids.length })
    } catch (error: any) {
      logError('Bulk delete products failed', { ids, error: error.message })
      throw error
    }
  }

  async bulkUpdateStatus(ids: string[], status: ProductStatus, userId?: string): Promise<void> {
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    await productsRepository.bulkUpdateStatus(ids, status)

    if (userId) {
      await AuditService.log('UPDATE', 'product', ids.join(','), userId, undefined, { status })
    }

    logInfo('Bulk status update', { count: ids.length, status })
  }

  async getFilterOptions() {
    return productsRepository.getFilterOptions()
  }

  async minimalActive(): Promise<{ id: string; product_name: string }[]> {
    return productsRepository.minimalActive()
  }

  async checkProductNameExists(productName: string, excludeId?: string): Promise<boolean> {
    const existing = await productsRepository.findByProductName(productName, excludeId)
    return !!existing
  }

  async restore(id: string, userId?: string): Promise<void> {
    await productsRepository.updateById(id, { is_deleted: false, updated_by: userId } as any)
    if (userId) {
      await AuditService.log('RESTORE', 'product', id, userId)
    }
    logInfo('Product restored', { id })
  }
}

export const productsService = new ProductsService()
