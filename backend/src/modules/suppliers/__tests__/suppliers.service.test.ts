import { suppliersService } from '../suppliers.service'
import { suppliersRepository } from '../suppliers.repository'
import { SupplierNotFoundError, SupplierCodeAlreadyExistsError } from '../suppliers.errors'

jest.mock('../suppliers.repository')

describe('SuppliersService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createSupplier', () => {
    it('should create supplier successfully', async () => {
      const mockSupplier = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        supplier_code: 'SUP001',
        supplier_name: 'Test Supplier',
        supplier_type: 'vegetables' as const,
        contact_person: 'John Doe',
        phone: '08123456789',
        email: 'test@example.com',
        address: 'Test Address',
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postal_code: '12345',
        tax_id: null,
        business_license: null,
        payment_term_id: null,
        lead_time_days: 1,
        minimum_order: 0,
        rating: null,
        is_active: true,
        notes: null,
        created_by: null,
        updated_by: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        deleted_at: null
      }

      ;(suppliersRepository.findByCode as jest.Mock).mockResolvedValue(null)
      ;(suppliersRepository.create as jest.Mock).mockResolvedValue(mockSupplier)

      const result = await suppliersService.createSupplier({
        supplier_code: 'SUP001',
        supplier_name: 'Test Supplier',
        supplier_type: 'vegetables',
        contact_person: 'John Doe',
        phone: '08123456789',
        email: 'test@example.com',
        address: 'Test Address',
        city: 'Jakarta',
        province: 'DKI Jakarta'
      })

      expect(result).toEqual(mockSupplier)
      expect(suppliersRepository.findByCode).toHaveBeenCalledWith('SUP001')
    })

    it('should throw error if supplier code already exists', async () => {
      const existingSupplier = { id: '123', supplier_code: 'SUP001' }
      ;(suppliersRepository.findByCode as jest.Mock).mockResolvedValue(existingSupplier)

      await expect(suppliersService.createSupplier({
        supplier_code: 'SUP001',
        supplier_name: 'Test',
        supplier_type: 'vegetables',
        contact_person: 'John',
        phone: '08123456789',
        address: 'Test',
        city: 'Jakarta',
        province: 'DKI'
      })).rejects.toThrow(SupplierCodeAlreadyExistsError)
    })
  })

  describe('updateSupplier', () => {
    it('should update supplier successfully', async () => {
      const existingSupplier = { id: '123e4567-e89b-12d3-a456-426614174000', supplier_name: 'Old Name' }
      const updatedSupplier = { id: '123e4567-e89b-12d3-a456-426614174000', supplier_name: 'New Name' }

      ;(suppliersRepository.findById as jest.Mock).mockResolvedValue(existingSupplier)
      ;(suppliersRepository.updateById as jest.Mock).mockResolvedValue(updatedSupplier)

      const result = await suppliersService.updateSupplier('123e4567-e89b-12d3-a456-426614174000', { supplier_name: 'New Name' })

      expect(result).toEqual(updatedSupplier)
    })

    it('should throw error if supplier not found', async () => {
      ;(suppliersRepository.findById as jest.Mock).mockResolvedValue(null)

      await expect(suppliersService.updateSupplier('999', { supplier_name: 'Test' }))
        .rejects.toThrow(SupplierNotFoundError)
    })

    it('should check duplicate supplier_code when updating', async () => {
      const existingSupplier = { id: '123', supplier_code: 'SUP001' }
      const duplicateSupplier = { id: '456', supplier_code: 'SUP002' }

      ;(suppliersRepository.findById as jest.Mock).mockResolvedValue(existingSupplier)
      ;(suppliersRepository.findByCode as jest.Mock).mockResolvedValue(duplicateSupplier)

      await expect(suppliersService.updateSupplier('123', { supplier_code: 'SUP002' }))
        .rejects.toThrow(SupplierCodeAlreadyExistsError)
    })
  })

  describe('deleteSupplier', () => {
    it('should soft delete supplier successfully', async () => {
      const existingSupplier = { id: '123', supplier_name: 'Test' }
      ;(suppliersRepository.findById as jest.Mock).mockResolvedValue(existingSupplier)
      ;(suppliersRepository.softDelete as jest.Mock).mockResolvedValue(undefined)

      await suppliersService.deleteSupplier('123')

      expect(suppliersRepository.softDelete).toHaveBeenCalledWith('123', undefined)
    })

    it('should throw error if supplier not found', async () => {
      ;(suppliersRepository.findById as jest.Mock).mockResolvedValue(null)

      await expect(suppliersService.deleteSupplier('999')).rejects.toThrow(SupplierNotFoundError)
    })
  })

  describe('getSupplierById', () => {
    it('should return supplier by id', async () => {
      const mockSupplier = { id: '123', supplier_name: 'Test' }
      ;(suppliersRepository.findById as jest.Mock).mockResolvedValue(mockSupplier)

      const result = await suppliersService.getSupplierById('123')

      expect(result).toEqual(mockSupplier)
    })

    it('should throw error if supplier not found', async () => {
      ;(suppliersRepository.findById as jest.Mock).mockResolvedValue(null)

      await expect(suppliersService.getSupplierById('999')).rejects.toThrow(SupplierNotFoundError)
    })
  })
})
