import { CompanyErrors } from '../companies.errors'
import { createCompanySchema, updateCompanySchema, bulkStatusSchema } from '../companies.schema'
import { CompanyConfig } from '../companies.config'

describe('Companies Module', () => {
  describe('CompanyErrors', () => {
    it('should create NOT_FOUND error with 404 status', () => {
      const error = CompanyErrors.NOT_FOUND()
      expect(error.code).toBe('COMPANY_NOT_FOUND')
      expect(error.statusCode).toBe(404)
      expect(error.message).toBe('Company not found')
    })

    it('should create CODE_EXISTS error with 409 status', () => {
      const error = CompanyErrors.CODE_EXISTS()
      expect(error.code).toBe('COMPANY_CODE_EXISTS')
      expect(error.statusCode).toBe(409)
    })

    it('should create NPWP_EXISTS error with 409 status', () => {
      const error = CompanyErrors.NPWP_EXISTS()
      expect(error.code).toBe('NPWP_EXISTS')
      expect(error.statusCode).toBe(409)
    })
  })

  describe('Validation Schemas', () => {
    describe('createCompanySchema', () => {
      it('should validate valid company data', () => {
        const validData = {
          company_code: 'TEST001',
          company_name: 'Test Company',
          company_type: 'PT' as const,
          status: 'active' as const
        }
        const result = createCompanySchema.parse(validData)
        expect(result.company_code).toBe('TEST001')
        expect(result.company_name).toBe('Test Company')
      })

      it('should reject empty company_code', () => {
        const invalidData = {
          company_code: '',
          company_name: 'Test Company'
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should reject empty company_name', () => {
        const invalidData = {
          company_code: 'TEST001',
          company_name: ''
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should reject invalid email', () => {
        const invalidData = {
          company_code: 'TEST001',
          company_name: 'Test Company',
          email: 'invalid-email'
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should reject invalid website URL', () => {
        const invalidData = {
          company_code: 'TEST001',
          company_name: 'Test Company',
          website: 'not-a-url'
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should accept valid NPWP (15 chars)', () => {
        const validData = {
          company_code: 'TEST001',
          company_name: 'Test Company',
          npwp: '123456789012345'
        }
        const result = createCompanySchema.parse(validData)
        expect(result.npwp).toBe('123456789012345')
      })

      it('should reject invalid NPWP length', () => {
        const invalidData = {
          company_code: 'TEST001',
          company_name: 'Test Company',
          npwp: '12345'
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should set default company_type to PT', () => {
        const data = {
          company_code: 'TEST001',
          company_name: 'Test Company'
        }
        const result = createCompanySchema.parse(data)
        expect(result.company_type).toBe('PT')
      })

      it('should set default status to active', () => {
        const data = {
          company_code: 'TEST001',
          company_name: 'Test Company'
        }
        const result = createCompanySchema.parse(data)
        expect(result.status).toBe('active')
      })
    })

    describe('updateCompanySchema', () => {
      it('should validate partial update', () => {
        const validData = {
          company_name: 'Updated Company'
        }
        const result = updateCompanySchema.parse(validData)
        expect(result.company_name).toBe('Updated Company')
      })

      it('should allow empty update', () => {
        const result = updateCompanySchema.parse({})
        expect(result).toEqual({})
      })
    })

    describe('bulkStatusSchema', () => {
      it('should validate bulk status update', () => {
        const validData = {
          ids: ['550e8400-e29b-41d4-a716-446655440000'],
          status: 'inactive' as const
        }
        const result = bulkStatusSchema.parse(validData)
        expect(result.ids).toHaveLength(1)
        expect(result.status).toBe('inactive')
      })

      it('should reject empty ids array', () => {
        const invalidData = {
          ids: [],
          status: 'inactive' as const
        }
        expect(() => bulkStatusSchema.parse(invalidData)).toThrow()
      })

      it('should reject invalid UUID', () => {
        const invalidData = {
          ids: ['not-a-uuid'],
          status: 'inactive' as const
        }
        expect(() => bulkStatusSchema.parse(invalidData)).toThrow()
      })
    })
  })

  describe('CompanyConfig', () => {
    it('should have correct company types', () => {
      expect(CompanyConfig.TYPES).toContain('PT')
      expect(CompanyConfig.TYPES).toContain('CV')
      expect(CompanyConfig.TYPES).toContain('Firma')
      expect(CompanyConfig.TYPES).toContain('Koperasi')
      expect(CompanyConfig.TYPES).toContain('Yayasan')
    })

    it('should have correct statuses', () => {
      expect(CompanyConfig.STATUSES).toContain('active')
      expect(CompanyConfig.STATUSES).toContain('inactive')
      expect(CompanyConfig.STATUSES).toContain('suspended')
      expect(CompanyConfig.STATUSES).toContain('closed')
    })

    it('should have validation rules', () => {
      expect(CompanyConfig.VALIDATION.CODE_MAX_LENGTH).toBe(20)
      expect(CompanyConfig.VALIDATION.NAME_MAX_LENGTH).toBe(255)
      expect(CompanyConfig.VALIDATION.NPWP_LENGTH).toBe(15)
    })
  })
})
