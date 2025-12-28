import { Request, Response } from 'express'
import { employeesController } from '../employees.controller'
import { employeesService } from '../employees.service'

jest.mock('../employees.service')
jest.mock('../../../config/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn()
}))
jest.mock('../../../utils/response.util', () => ({
  sendSuccess: jest.fn((res, data, message, status = 200) => res.status(status).json({ success: true, data, message })),
  sendError: jest.fn((res, message, status = 400) => res.status(status).json({ success: false, message }))
}))

describe('EmployeesController', () => {
  let mockReq: any
  let mockRes: any

  beforeEach(() => {
    mockReq = {
      user: { id: 'user-1' },
      pagination: { page: 1, limit: 10 },
      query: {},
      body: {},
      params: {}
    }
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    }
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('should return paginated employees', async () => {
      const mockResult = {
        data: [{ id: '1', full_name: 'John' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
      }
      
      ;(employeesService.list as jest.Mock).mockResolvedValue(mockResult)

      await employeesController.list(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.data,
        pagination: mockResult.pagination
      })
    })

    it('should handle errors', async () => {
      ;(employeesService.list as jest.Mock).mockRejectedValue(new Error('DB Error'))

      await employeesController.list(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })
  })

  describe('create', () => {
    it('should create employee with valid payload', async () => {
      const mockEmployee = { id: '1', employee_id: 'EMP001', full_name: 'John' }
      mockReq.body = {
        full_name: 'John',
        job_position: 'Manager',
        brand_name: 'Brand A',
        join_date: '2024-01-01',
        status_employee: 'Permanent',
        ptkp_status: 'TK/0'
      }
      
      ;(employeesService.create as jest.Mock).mockResolvedValue(mockEmployee)

      await employeesController.create(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(201)
    })

    it('should return 400 on validation error', async () => {
      mockReq.body = { full_name: '' }

      await employeesController.create(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it('should return 409 on duplicate employee_id', async () => {
      mockReq.body = {
        full_name: 'John',
        job_position: 'Manager',
        brand_name: 'Brand A',
        join_date: '2024-01-01',
        status_employee: 'Permanent',
        ptkp_status: 'TK/0'
      }
      
      ;(employeesService.create as jest.Mock).mockRejectedValue(new Error('Employee ID already exists'))

      await employeesController.create(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(409)
    })
  })

  describe('update', () => {
    it('should update employee', async () => {
      const mockEmployee = { id: '1', full_name: 'Jane' }
      mockReq.params.id = '1'
      mockReq.body = { full_name: 'Jane' }
      
      ;(employeesService.update as jest.Mock).mockResolvedValue(mockEmployee)

      await employeesController.update(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
    })
  })

  describe('delete', () => {
    it('should delete employee', async () => {
      mockReq.params.id = '1'
      
      ;(employeesService.delete as jest.Mock).mockResolvedValue(undefined)

      await employeesController.delete(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
    })
  })

  describe('bulkUpdateActive', () => {
    it('should update multiple employees', async () => {
      const validUuid1 = '550e8400-e29b-41d4-a716-446655440000'
      const validUuid2 = '550e8400-e29b-41d4-a716-446655440001'
      mockReq.body = { ids: [validUuid1, validUuid2], is_active: false }
      
      ;(employeesService.bulkUpdateActive as jest.Mock).mockResolvedValue(undefined)

      await employeesController.bulkUpdateActive(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
    })

    it('should return 400 on validation error', async () => {
      mockReq.body = { ids: [], is_active: false }

      await employeesController.bulkUpdateActive(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })
  })

  describe('getById', () => {
    it('should return employee', async () => {
      const mockEmployee = { id: '1', full_name: 'John' }
      mockReq.params.id = '1'
      
      ;(employeesService.getById as jest.Mock).mockResolvedValue(mockEmployee)

      await employeesController.getById(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(200)
    })

    it('should return 404 if not found', async () => {
      mockReq.params.id = '999'
      
      ;(employeesService.getById as jest.Mock).mockRejectedValue(new Error('Employee not found'))

      await employeesController.getById(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(404)
    })
  })
})
