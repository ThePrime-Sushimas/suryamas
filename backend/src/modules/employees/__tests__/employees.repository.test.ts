import { employeesRepository } from '../employees.repository'
import { supabase } from '../../../config/supabase'

jest.mock('../../../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn()
    },
    rpc: jest.fn()
  }
}))

describe('EmployeesRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('findAll', () => {
    it('should return paginated employees with branches', async () => {
      const mockData = [
        { id: '1', full_name: 'John', employee_branches: [{ is_primary: true, branches: { branch_name: 'HQ' } }] }
      ]
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockData, error: null, count: 1 })
      }
      
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const result = await employeesRepository.findAll({ page: 1, limit: 10 })

      expect(result.total).toBe(1)
      expect(result.data[0].branch_name).toBe('HQ')
    })

    it('should throw error on database failure', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' }, count: 0 })
      }
      
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      await expect(employeesRepository.findAll({ page: 1, limit: 10 })).rejects.toThrow('DB Error')
    })
  })

  describe('create', () => {
    it('should create employee and return data', async () => {
      const mockEmployee = { id: '1', employee_id: 'EMP001', full_name: 'John' }
      
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockEmployee, error: null })
      }
      
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const result = await employeesRepository.create({ full_name: 'John' })

      expect(result.full_name).toBe('John')
    })

    it('should throw conflict error on duplicate employee_id', async () => {
      const mockQuery = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'Duplicate' } })
      }
      
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      await expect(employeesRepository.create({ employee_id: 'EMP001' })).rejects.toThrow('Employee ID already exists')
    })
  })

  describe('search', () => {
    it('should search with filters', async () => {
      const mockData = [{ id: '1', full_name: 'John Doe' }]
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockData, error: null, count: 1 })
      }
      
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const result = await employeesRepository.search('John', { page: 1, limit: 10 }, { is_active: true })

      expect(result.total).toBe(1)
      expect(mockQuery.or).toHaveBeenCalled()
    })
  })

  describe('bulkUpdateActive', () => {
    it('should update multiple employees', async () => {
      const mockQuery = {
        update: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ error: null })
      }
      
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      await employeesRepository.bulkUpdateActive(['1', '2'], false)

      expect(mockQuery.update).toHaveBeenCalledWith({ is_active: false })
      expect(mockQuery.in).toHaveBeenCalledWith('id', ['1', '2'])
    })
  })
})
