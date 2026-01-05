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

export class ProductUomsService {
  async getByProductId(productId: string, includeDeleted = false): Promise<ProductUom[]> {
    return productUomsRepository.findByProductId(productId, includeDeleted)
  }

  async create(productId: string, dto: CreateProductUomDto, userId?: string): Promise<ProductUom> {
    if (!dto.unit_name || dto.conversion_factor === undefined) {
      throw new ProductUomValidationError('Missing required fields: unit_name, conversion_factor')
    }

    if (dto.conversion_factor <= 0) {
      throw new InvalidConversionFactorError('Conversion factor must be greater than 0')
    }

    if (dto.status_uom && !VALID_UOM_STATUSES.includes(dto.status_uom)) {
      throw new InvalidUomStatusError(dto.status_uom, VALID_UOM_STATUSES)
    }

    if (dto.is_base_unit && dto.conversion_factor !== 1) {
      throw new InvalidConversionFactorError('Base unit must have conversion factor of 1')
    }

    const existing = await productUomsRepository.findByProductIdAndUnitName(productId, dto.unit_name)
    if (existing) {
      throw new DuplicateUnitNameError(dto.unit_name)
    }

    if (dto.is_base_unit) {
      const baseUom = await productUomsRepository.findBaseUom(productId)
      if (baseUom) {
        throw new BaseUnitExistsError()
      }
    }

    if (dto.is_default_base_unit) {
      await productUomsRepository.clearDefaultBaseUnit(productId)
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

    logInfo('Product UOM created', { id: uom.id, productId, unitName: uom.unit_name, userId })
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
      if (baseUom) {
        throw new BaseUnitExistsError()
      }
    }

    if (dto.is_default_base_unit) {
      await productUomsRepository.clearDefaultBaseUnit(current.product_id)
    }

    const data = { ...dto, updated_by: userId }
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
