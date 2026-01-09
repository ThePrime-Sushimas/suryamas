import { suppliersRepository } from './suppliers.repository'
import { Supplier, CreateSupplierDto, UpdateSupplierDto, SupplierListQuery, SupplierOption } from './suppliers.types'
import { SupplierNotFoundError, SupplierCodeAlreadyExistsError } from './suppliers.errors'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'

export class SuppliersService {
  async createSupplier(data: CreateSupplierDto, userId?: string): Promise<Supplier> {
    // Check if supplier code already exists
    const existingSupplier = await suppliersRepository.findByCode(data.supplier_code)
    if (existingSupplier) {
      throw new SupplierCodeAlreadyExistsError(data.supplier_code)
    }

    return suppliersRepository.create({
      ...data,
      created_by: userId,
    })
  }

  async updateSupplier(id: string, data: UpdateSupplierDto, userId?: string): Promise<Supplier> {
    const existingSupplier = await suppliersRepository.findById(id)
    if (!existingSupplier) {
      throw new SupplierNotFoundError(id)
    }

    // Check if supplier_code is being updated and already exists
    if (data.supplier_code) {
      const codeExists = await suppliersRepository.findByCode(data.supplier_code, id)
      if (codeExists) {
        throw new SupplierCodeAlreadyExistsError(data.supplier_code)
      }
    }

    const updatedSupplier = await suppliersRepository.updateById(id, {
      ...data,
      updated_by: userId,
    })

    if (!updatedSupplier) {
      throw new SupplierNotFoundError(id)
    }

    return updatedSupplier
  }

  async deleteSupplier(id: string, userId?: string): Promise<void> {
    const supplier = await suppliersRepository.findById(id)
    if (!supplier) {
      throw new SupplierNotFoundError(id)
    }

    // TODO: Check if supplier is used in procurement
    // This would require checking procurement/purchase_orders tables
    // For now, we'll just perform the soft delete

    await suppliersRepository.softDelete(id, userId)
  }

  async getSupplierById(id: string): Promise<Supplier> {
    const supplier = await suppliersRepository.findById(id)
    if (!supplier) {
      throw new SupplierNotFoundError(id)
    }
    return supplier
  }

  async getSuppliers(query: SupplierListQuery) {
    const { page, limit, offset } = getPaginationParams(query as any)
    const { data, total } = await suppliersRepository.findAll({ limit, offset }, query)
    
    return createPaginatedResponse(data, total, page, limit)
  }

  async getSupplierOptions(): Promise<SupplierOption[]> {
    return suppliersRepository.getActiveOptions()
  }

  async restoreSupplier(id: string, userId?: string): Promise<Supplier> {
    const restored = await suppliersRepository.restore(id, userId)
    if (!restored) {
      throw new SupplierNotFoundError(id)
    }
    return restored
  }
}

export const suppliersService = new SuppliersService()