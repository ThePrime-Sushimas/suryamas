import { CompanyErrors } from '../companies.errors'
import { createCompanySchema, updateCompanySchema, bulkUpdateStatusSchema } from '../companies.schema'
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
          body: {
            company_code: 'TEST001',
            company_name: 'Test Company',
            company_type: 'PT' as const,
            status: 'active' as const
          }
        }
        const result = createCompanySchema.parse(validData)
        expect(result.body.company_code).toBe('TEST001')
        expect(result.body.company_name).toBe('Test Company')
      })

      it('should reject empty company_code', () => {
        const invalidData = {
          body: {
            company_code: '',
            company_name: 'Test Company'
          }
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should reject empty company_name', () => {
        const invalidData = {
          body: {
            company_code: 'TEST001',
            company_name: ''
          }
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should reject invalid email', () => {
        const invalidData = {
          body: {
            company_code: 'TEST001',
            company_name: 'Test Company',
            email: 'invalid-email'
          }
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should reject invalid website URL', () => {
        const invalidData = {
          body: {
            company_code: 'TEST001',
            company_name: 'Test Company',
            website: 'not-a-url'
          }
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should accept valid NPWP (15 chars)', () => {
        const validData = {
          body: {
            company_code: 'TEST001',
            company_name: 'Test Company',
            npwp: '123456789012345'
          }
        }
        const result = createCompanySchema.parse(validData)
        expect(result.body.npwp).toBe('123456789012345')
      })

      it('should reject invalid NPWP length', () => {
        const invalidData = {
          body: {
            company_code: 'TEST001',
            company_name: 'Test Company',
            npwp: '12345'
          }
        }
        expect(() => createCompanySchema.parse(invalidData)).toThrow()
      })

      it('should set default company_type to PT', () => {
        const data = {
          body: {
            company_code: 'TEST001',
            company_name: 'Test Company'
          }
        }
        const result = createCompanySchema.parse(data)
        expect(result.body.company_type).toBe('PT')
      })

      it('should set default status to active', () => {
        const data = {
          body: {
            company_code: 'TEST001',
            company_name: 'Test Company'
          }
        }
        const result = createCompanySchema.parse(data)
        expect(result.body.status).toBe('active')
      })
    })

    describe('updateCompanySchema', () => {
      it('should validate partial update', () => {
        const validData = {
          params: { id: '550e8400-e29b-41d4-a716-446655440000' },
          body: {
            company_name: 'Updated Company'
          }
        }
        const result = updateCompanySchema.parse(validData)
        expect(result.body.company_name).toBe('Updated Company')
      })

      it('should allow empty update', () => {
        const result = updateCompanySchema.parse({
          params: { id: '550e8400-e29b-41d4-a716-446655440000' },
          body: {}
        })
        expect(result.body).toEqual({})
      })
    })

    describe('bulkUpdateStatusSchema', () => {
      it('should validate bulk status update', () => {
        const validData = {
          body: {
            ids: ['550e8400-e29b-41d4-a716-446655440000'],
            status: 'inactive' as const
          }
        }
        const result = bulkUpdateStatusSchema.parse(validData)
        expect(result.body.ids).toHaveLength(1)
        expect(result.body.status).toBe('inactive')
      })

      it('should reject empty ids array', () => {
        const invalidData = {
          body: {
            ids: [],
            status: 'inactive' as const
          }
        }
        expect(() => bulkUpdateStatusSchema.parse(invalidData)).toThrow()
      })

      it('should reject invalid UUID', () => {
        const invalidData = {
          body: {
            ids: ['not-a-uuid'],
            status: 'inactive' as const
          }
        }
        expect(() => bulkUpdateStatusSchema.parse(invalidData)).toThrow()
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
