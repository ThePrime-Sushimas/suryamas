import { productUomsRepository } from './product-uoms.repository'
import { ProductUom, CreateProductUomDto, UpdateProductUomDto, UomStatus } from '../products/products.types'
import { AuditService } from '../../services/audit.service'
import { logError, logInfo } from '../../config/logger'

const VALID_UOM_STATUSES: UomStatus[] = ['ACTIVE', 'INACTIVE']

export class ProductUomsService {
  async getByProductId(productId: string, includeDeleted = false): Promise<ProductUom[]> {
    return productUomsRepository.findByProductId(productId, includeDeleted)
  }

  async create(productId: string, dto: CreateProductUomDto, userId?: string): Promise<ProductUom> {
    if (!dto.unit_name || !dto.conversion_factor) {
      throw new Error('Missing required fields: unit_name, conversion_factor')
    }

    if (dto.conversion_factor <= 0) {
      throw new Error('Conversion factor must be greater than 0')
    }

    if (dto.status_uom && !VALID_UOM_STATUSES.includes(dto.status_uom)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_UOM_STATUSES.join(', ')}`)
    }

    if (dto.is_base_unit && dto.conversion_factor !== 1) {
      throw new Error('Base unit must have conversion factor of 1')
    }

    const existing = await productUomsRepository.findByProductIdAndUnitName(productId, dto.unit_name)
    if (existing) {
      throw new Error(`UOM "${dto.unit_name}" already exists for this product`)
    }

    if (dto.is_base_unit) {
      const baseUom = await productUomsRepository.findBaseUom(productId)
      if (baseUom) {
        throw new Error('Product already has a base unit')
      }
    }

    if (dto.is_default_base_unit) {
      await productUomsRepository.clearDefaultBaseUnit(productId)
    }

    const data: any = {
      ...dto,
      product_id: productId,
      status_uom: dto.status_uom || 'ACTIVE',
      is_base_unit: dto.is_base_unit ?? false,
      created_by: userId,
      updated_by: userId,
    }

    const uom = await productUomsRepository.create(data)

    if (userId) {
      await AuditService.log('CREATE', 'product_uom', uom.id, userId, undefined, uom)
    }

    logInfo('Product UOM created', { id: uom.id, productId })
    return uom
  }

  async update(id: string, dto: UpdateProductUomDto, userId?: string): Promise<ProductUom | null> {
    if (dto.conversion_factor && dto.conversion_factor <= 0) {
      throw new Error('Conversion factor must be greater than 0')
    }

    if (dto.status_uom && !VALID_UOM_STATUSES.includes(dto.status_uom)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_UOM_STATUSES.join(', ')}`)
    }

    if (dto.is_base_unit && dto.conversion_factor && dto.conversion_factor !== 1) {
      throw new Error('Base unit must have conversion factor of 1')
    }

    const current = await productUomsRepository.findById(id)
    if (!current) {
      throw new Error('UOM not found')
    }

    if (dto.is_base_unit && !current.is_base_unit) {
      const baseUom = await productUomsRepository.findBaseUom(current.product_id)
      if (baseUom) {
        throw new Error('Product already has a base unit')
      }
    }

    if (dto.is_default_base_unit) {
      await productUomsRepository.clearDefaultBaseUnit(current.product_id)
    }

    const data: any = { ...dto, updated_by: userId }
    const uom = await productUomsRepository.updateById(id, data)

    if (uom && userId) {
      await AuditService.log('UPDATE', 'product_uom', id, userId, undefined, dto)
    }

    logInfo('Product UOM updated', { id })
    return uom
  }

  async delete(id: string, userId?: string): Promise<void> {
    try {
      await productUomsRepository.delete(id)

      if (userId) {
        await AuditService.log('DELETE', 'product_uom', id, userId)
      }

      logInfo('Product UOM deleted', { id })
    } catch (error: any) {
      logError('Delete product UOM failed', { id, error: error.message })
      throw error
    }
  }

  async restore(id: string, userId?: string): Promise<ProductUom | null> {
    try {
      const uom = await productUomsRepository.restore(id)

      if (uom && userId) {
        await AuditService.log('RESTORE', 'product_uom', id, userId)
      }

      logInfo('Product UOM restored', { id })
      return uom
    } catch (error: any) {
      logError('Restore product UOM failed', { id, error: error.message })
      throw error
    }
  }
}

export const productUomsService = new ProductUomsService()
