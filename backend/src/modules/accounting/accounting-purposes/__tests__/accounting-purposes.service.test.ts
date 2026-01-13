import { AccountingPurposesService } from '../accounting-purposes.service'
import { AccountingPurposeErrors } from '../accounting-purposes.errors'

describe('AccountingPurposesService', () => {
  let service: AccountingPurposesService
  let mockRepository: any
  let mockAuditService: any

  beforeEach(() => {
    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      bulkUpdateStatus: jest.fn(),
      bulkDelete: jest.fn()
    }
    
    mockAuditService = {
      log: jest.fn()
    }

    service = new AccountingPurposesService(mockRepository, mockAuditService)
  })

  describe('validateFilter', () => {
    it('should validate applied_to enum values', () => {
      const filter = { applied_to: 'INVALID_TYPE' }
      const result = (service as any).validateFilter(filter)
      expect(result.applied_to).toBeUndefined()
    })

    it('should accept valid applied_to values', () => {
      const filter = { applied_to: 'SALES' }
      const result = (service as any).validateFilter(filter)
      expect(result.applied_to).toBe('SALES')
    })
  })

  describe('create', () => {
    it('should throw error for invalid applied_to', async () => {
      const data = {
        company_id: 'test-company',
        purpose_code: 'TEST',
        purpose_name: 'Test Purpose',
        applied_to: 'INVALID' as any
      }

      await expect(service.create(data, 'user-id')).rejects.toThrow(
        AccountingPurposeErrors.INVALID_APPLIED_TO('INVALID')
      )
    })
  })
})