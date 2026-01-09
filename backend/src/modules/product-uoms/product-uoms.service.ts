import { productUomsRepository } from './product-uoms.repository'
import { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../products/products.types'
import { AuditService } from '../../services/audit.service'
import { logInfo } from '../../config/logger'
import {
  ProductUomNotFoundError,
  DuplicateUnitNameError,
  BaseUnitExistsError,
  InvalidConversionFactorError,
  InvalidUomStatusError,
  ProductUomValidationError,
} from './product-uoms.errors'
import { VALID_UOM_STATUSES, UOM_DEFAULTS } from './product-uoms.constants'
import { metricUnitsRepository } from '../metric-units/metricUnits.repository'

type DefaultField = 'is_default_stock_unit' | 'is_default_purchase_unit' | 'is_default_transfer_unit'

export class ProductUomsService {
  async getByProductId(productId: string, includeDeleted = false): Promise<ProductUom[]> {
    return productUomsRepository.findByProductId(productId, includeDeleted)
  }

  /**
   * Helper to ensure only one UOM has the specified default flag per product
   */
  private async ensureSingleDefault(
    productId: string,
    field: DefaultField,
    currentId?: string
  ): Promise<void> {
    const existing = await productUomsRepository.findDefaultByProduct(productId, field)
    if (existing && existing.id !== currentId) {
      await productUomsRepository.updateById(existing.id, { [field]: false })
    }
  }

  async create(productId: string, dto: CreateProductUomDto, userId?: string): Promise<ProductUom> {
    if (!dto.metric_unit_id) {
      throw new ProductUomValidationError('metric_unit_id is required')
    }

    if (dto.conversion_factor === undefined || dto.conversion_factor <= 0) {
      throw new InvalidConversionFactorError('Conversion factor must be greater than 0')
    }

    if (dto.status_uom && !VALID_UOM_STATUSES.includes(dto.status_uom)) {
      throw new InvalidUomStatusError(dto.status_uom, VALID_UOM_STATUSES)
    }

    if (dto.is_base_unit && dto.conversion_factor !== 1) {
      throw new InvalidConversionFactorError('Base unit must have conversion factor of 1')
    }

    const metricUnit = await metricUnitsRepository.findById(dto.metric_unit_id)
    if (!metricUnit) {
      throw new ProductUomValidationError('Invalid metric_unit_id')
    }

    const existing = await productUomsRepository.findByProductIdAndMetricUnit(productId, dto.metric_unit_id)
    if (existing) {
      throw new DuplicateUnitNameError('This unit already exists for this product')
    }

    if (dto.is_base_unit) {
      const baseUom = await productUomsRepository.findBaseUom(productId)
      if (baseUom) {
        throw new BaseUnitExistsError()
      }
    }

    // Ensure only one default per type before creating
    if (dto.is_default_stock_unit) {
      await this.ensureSingleDefault(productId, 'is_default_stock_unit')
    }
    if (dto.is_default_purchase_unit) {
      await this.ensureSingleDefault(productId, 'is_default_purchase_unit')
    }
    if (dto.is_default_transfer_unit) {
      await this.ensureSingleDefault(productId, 'is_default_transfer_unit')
    }

    const data = {
      ...dto,
      product_id: productId,
      status_uom: dto.status_uom || UOM_DEFAULTS.STATUS,
      is_base_unit: dto.is_base_unit ?? UOM_DEFAULTS.IS_BASE_UNIT,
      created_by: userId,
      updated_by: userId,
    }

    const uom = await productUomsRepository.create(data)

    if (userId) {
      await AuditService.log('CREATE', 'product_uom', uom.id, userId, undefined, uom)
    }

    logInfo('Product UOM created', { id: uom.id, productId, userId })
    return uom
  }

  async update(id: string, dto: UpdateProductUomDto, userId?: string): Promise<ProductUom | null> {
    if (dto.conversion_factor !== undefined && dto.conversion_factor <= 0) {
      throw new InvalidConversionFactorError('Conversion factor must be greater than 0')
    }

    if (dto.status_uom && !VALID_UOM_STATUSES.includes(dto.status_uom)) {
      throw new InvalidUomStatusError(dto.status_uom, VALID_UOM_STATUSES)
    }

    if (dto.is_base_unit && dto.conversion_factor && dto.conversion_factor !== 1) {
      throw new InvalidConversionFactorError('Base unit must have conversion factor of 1')
    }

    const current = await productUomsRepository.findById(id)
    if (!current) {
      throw new ProductUomNotFoundError(id)
    }

    if (dto.is_base_unit && !current.is_base_unit) {
      const baseUom = await productUomsRepository.findBaseUom(current.product_id)
      if (baseUom && baseUom.id !== id) {
        // Unset the old base unit - only update is_base_unit, don't touch unit_name
        await productUomsRepository.updateById(baseUom.id, { 
          is_base_unit: false
        })
      }
      // Force conversion factor to 1 for new base unit
      dto.conversion_factor = 1
    }

    // Ensure only one default per type before updating
    if (dto.is_default_stock_unit) {
      await this.ensureSingleDefault(current.product_id, 'is_default_stock_unit', id)
    }
    if (dto.is_default_purchase_unit) {
      await this.ensureSingleDefault(current.product_id, 'is_default_purchase_unit', id)
    }
    if (dto.is_default_transfer_unit) {
      await this.ensureSingleDefault(current.product_id, 'is_default_transfer_unit', id)
    }

    const data: UpdateProductUomDto & { updated_by?: string } = { updated_by: userId }
    
    // Only include fields that are actually being updated
    if (dto.conversion_factor !== undefined) data.conversion_factor = dto.conversion_factor
    if (dto.is_base_unit !== undefined) data.is_base_unit = dto.is_base_unit
    if (dto.base_price !== undefined) data.base_price = dto.base_price
    if (dto.is_default_stock_unit !== undefined) data.is_default_stock_unit = dto.is_default_stock_unit
    if (dto.is_default_purchase_unit !== undefined) data.is_default_purchase_unit = dto.is_default_purchase_unit
    if (dto.is_default_transfer_unit !== undefined) data.is_default_transfer_unit = dto.is_default_transfer_unit
    if (dto.status_uom !== undefined) data.status_uom = dto.status_uom
    
    // Only update metric_unit_id if it actually changed
    if (dto.metric_unit_id !== undefined && dto.metric_unit_id !== current.metric_unit_id) {
      const metricUnit = await metricUnitsRepository.findById(dto.metric_unit_id)
      if (!metricUnit) {
        throw new ProductUomValidationError('Invalid metric_unit_id')
      }
      
      // Check if unit already exists for this product
      const existing = await productUomsRepository.findByProductIdAndMetricUnit(current.product_id, dto.metric_unit_id)
      if (existing && existing.id !== id) {
        throw new DuplicateUnitNameError('This unit already exists for this product')
      }
      
      data.metric_unit_id = dto.metric_unit_id
    }

    const uom = await productUomsRepository.updateById(id, data)

    if (uom && userId) {
      await AuditService.log('UPDATE', 'product_uom', id, userId, current, dto)
    }

    logInfo('Product UOM updated', { id, productId: current.product_id, userId })
    return uom
  }

  async delete(id: string, userId?: string): Promise<void> {
    const current = await productUomsRepository.findById(id)
    if (!current) {
      throw new ProductUomNotFoundError(id)
    }

    // Prevent deletion of base unit
    if (current.is_base_unit) {
      throw new ProductUomValidationError('Base unit cannot be deleted')
    }

    await productUomsRepository.delete(id)

    if (userId) {
      await AuditService.log('DELETE', 'product_uom', id, userId, current)
    }

    logInfo('Product UOM deleted', { id, productId: current.product_id, userId })
  }

  async restore(id: string, userId?: string): Promise<ProductUom | null> {
    const current = await productUomsRepository.findById(id, true)
    if (!current) {
      throw new ProductUomNotFoundError(id)
    }

    const uom = await productUomsRepository.restore(id)

    if (uom && userId) {
      await AuditService.log('RESTORE', 'product_uom', id, userId, current)
    }

    logInfo('Product UOM restored', { id, productId: current.product_id, userId })
    return uom
  }
}

export const productUomsService = new ProductUomsService()

