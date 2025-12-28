import { CreateEmployeeSchema, UpdateEmployeeSchema, UpdateProfileSchema, BulkUpdateActiveSchema } from '../employees.schema'

describe('Employee Schema Validation', () => {
  describe('CreateEmployeeSchema', () => {
    const validPayload = {
      full_name: 'John Doe',
      job_position: 'Manager',
      brand_name: 'Brand A',
      join_date: '2024-01-01',
      status_employee: 'Permanent' as const,
      ptkp_status: 'TK/0' as const
    }

    it('should validate valid permanent employee', () => {
      expect(() => CreateEmployeeSchema.parse(validPayload)).not.toThrow()
    })

    it('should require end_date for contract employee', () => {
      const payload = { ...validPayload, status_employee: 'Contract' as const }
      expect(() => CreateEmployeeSchema.parse(payload)).toThrow('end_date is required')
    })

    it('should reject resign_date before join_date', () => {
      const payload = { ...validPayload, resign_date: '2023-12-31' }
      expect(() => CreateEmployeeSchema.parse(payload)).toThrow('resign_date cannot be before join_date')
    })

    it('should reject invalid date format', () => {
      const payload = { ...validPayload, join_date: '01-01-2024' }
      expect(() => CreateEmployeeSchema.parse(payload)).toThrow('Date must be in YYYY-MM-DD format')
    })

    it('should accept contract employee with end_date', () => {
      const payload = { ...validPayload, status_employee: 'Contract' as const, end_date: '2024-12-31' }
      expect(() => CreateEmployeeSchema.parse(payload)).not.toThrow()
    })
  })

  describe('UpdateEmployeeSchema', () => {
    it('should allow partial updates', () => {
      const payload = { full_name: 'Jane Doe' }
      expect(() => UpdateEmployeeSchema.parse(payload)).not.toThrow()
    })

    it('should not allow employee_id update', () => {
      const payload = { employee_id: 'EMP001' } as any
      const result = UpdateEmployeeSchema.safeParse(payload)
      expect(result.success).toBe(true)
      expect((result as any).data.employee_id).toBeUndefined()
    })
  })

  describe('BulkUpdateActiveSchema', () => {
    it('should validate bulk update payload', () => {
      const payload = { ids: ['uuid-1', 'uuid-2'], is_active: true }
      expect(() => BulkUpdateActiveSchema.parse(payload)).toThrow()
    })

    it('should require at least one id', () => {
      const payload = { ids: [], is_active: true }
      expect(() => BulkUpdateActiveSchema.parse(payload)).toThrow()
    })
  })
})
