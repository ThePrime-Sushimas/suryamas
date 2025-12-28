import { employeesService } from '../employees.service'
import { employeesRepository } from '../employees.repository'
import { AuditService } from '../../../services/audit.service'
import { supabase } from '../../../config/supabase'

jest.mock('../employees.repository')
jest.mock('../../../services/audit.service')
jest.mock('../../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn()
  }
}))

describe('EmployeesService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create employee with auto-generated ID', async () => {
      const mockEmployee = { id: '1', employee_id: 'EMP001', full_name: 'John', join_date: '2024-01-01' }
      
      ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: 'EMP001', error: null })
      ;(employeesRepository.create as jest.Mock).mockResolvedValue(mockEmployee)
      ;(employeesRepository.findById as jest.Mock).mockResolvedValue({ ...mockEmployee, branch_name: null })
      ;(AuditService.log as jest.Mock).mockResolvedValue(undefined)

      const result = await employeesService.create({
        full_name: 'John',
        job_position: 'Manager',
        brand_name: 'Brand A',
        join_date: '2024-01-01',
        status_employee: 'Permanent',
        ptkp_status: 'TK/0'
      })

      expect(result.employee_id).toBe('EMP001')
      expect(AuditService.log).toHaveBeenCalledWith('CREATE', 'employee', '1', null, null, mockEmployee)
    })

    it('should throw error if ID generation fails', async () => {
      ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'RPC Error' } })

      await expect(employeesService.create({
        full_name: 'John',
        job_position: 'Manager',
        brand_name: 'Brand A',
        join_date: '2024-01-01',
        status_employee: 'Permanent',
        ptkp_status: 'TK/0'
      })).rejects.toThrow('Failed to generate employee ID')
    })
  })

  describe('update', () => {
    it('should update employee and log audit', async () => {
      const oldEmployee = { id: '1', full_name: 'John' }
      const updatedEmployee = { id: '1', full_name: 'Jane' }
      
      ;(employeesRepository.findById as jest.Mock)
        .mockResolvedValueOnce(oldEmployee)
        .mockResolvedValueOnce({ ...updatedEmployee, branch_name: null })
      ;(employeesRepository.updateById as jest.Mock).mockResolvedValue(updatedEmployee)
      ;(AuditService.log as jest.Mock).mockResolvedValue(undefined)

      const result = await employeesService.update('1', { full_name: 'Jane' })

      expect(result.full_name).toBe('Jane')
      expect(AuditService.log).toHaveBeenCalledWith('UPDATE', 'employee', '1', null, oldEmployee, updatedEmployee)
    })

    it('should throw error if no fields to update', async () => {
      await expect(employeesService.update('1', {})).rejects.toThrow('No valid fields to update')
    })
  })

  describe('bulkUpdateActive', () => {
    it('should update multiple employees', async () => {
      ;(employeesRepository.bulkUpdateActive as jest.Mock).mockResolvedValue(undefined)

      await employeesService.bulkUpdateActive(['1', '2'], false)

      expect(employeesRepository.bulkUpdateActive).toHaveBeenCalledWith(['1', '2'], false)
    })

    it('should throw error if no IDs provided', async () => {
      await expect(employeesService.bulkUpdateActive([], true)).rejects.toThrow('No IDs provided')
    })
  })

  describe('getById', () => {
    it('should return employee with computed fields', async () => {
      const mockEmployee = {
        id: '1',
        full_name: 'John',
        birth_date: '1990-01-01',
        join_date: '2020-01-01',
        resign_date: null
      }
      
      ;(employeesRepository.findById as jest.Mock).mockResolvedValue(mockEmployee)

      const result = await employeesService.getById('1')

      expect(result.age).toBeDefined()
      expect(result.years_of_service).toBeDefined()
    })

    it('should throw error if employee not found', async () => {
      ;(employeesRepository.findById as jest.Mock).mockResolvedValue(null)

      await expect(employeesService.getById('999')).rejects.toThrow('Employee not found')
    })
  })
})
