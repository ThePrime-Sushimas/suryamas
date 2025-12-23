import { employeeBranchesRepository } from './employee_branches.repository'
import { EmployeeBranch, EmployeeBranchWithDetails, CreateEmployeeBranchDto, UpdateEmployeeBranchDto } from './employee_branches.types'
import { logError, logInfo } from '../../config/logger'

export class EmployeeBranchesService {
  async list(pagination: { page: number; limit: number }): Promise<{ data: EmployeeBranchWithDetails[]; pagination: any }> {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await employeeBranchesRepository.findAll({ limit: pagination.limit, offset })

    const totalPages = Math.ceil(total / pagination.limit)
    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    }
  }

  async getByEmployeeId(employeeId: string): Promise<EmployeeBranchWithDetails[]> {
    return employeeBranchesRepository.findByEmployeeId(employeeId)
  }

  async getById(id: string): Promise<EmployeeBranchWithDetails> {
    const result = await employeeBranchesRepository.findById(id)
    if (!result) {
      throw new Error('Employee branch not found')
    }
    return result
  }

  async getByBranchId(branchId: string, pagination: { page: number; limit: number }): Promise<{ data: EmployeeBranchWithDetails[]; pagination: any }> {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await employeeBranchesRepository.findByBranchId(branchId, { limit: pagination.limit, offset })

    const totalPages = Math.ceil(total / pagination.limit)
    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    }
  }

  async getPrimaryBranch(employeeId: string): Promise<EmployeeBranchWithDetails | null> {
    return employeeBranchesRepository.findPrimaryBranch(employeeId)
  }

  async create(dto: CreateEmployeeBranchDto): Promise<EmployeeBranch> {
    if (!dto.employee_id || !dto.branch_id) {
      throw new Error('employee_id and branch_id are required')
    }

    // Check if relationship already exists
    const existing = await employeeBranchesRepository.findByEmployeeId(dto.employee_id)
    const alreadyExists = existing.some(eb => eb.branch_id === dto.branch_id)
    if (alreadyExists) {
      throw new Error('Employee is already assigned to this branch')
    }

    // If this is the first branch or marked as primary, set as primary
    const isPrimary = dto.is_primary || existing.length === 0

    const result = await employeeBranchesRepository.create({
      employee_id: dto.employee_id,
      branch_id: dto.branch_id,
      is_primary: isPrimary,
    })

    logInfo('Employee branch created', { employee_id: dto.employee_id, branch_id: dto.branch_id })
    return result
  }

  async update(id: string, dto: UpdateEmployeeBranchDto): Promise<EmployeeBranch | null> {
    const result = await employeeBranchesRepository.update(id, dto)
    logInfo('Employee branch updated', { id })
    return result
  }

  async setPrimaryBranch(employeeId: string, branchId: string): Promise<void> {
    // Verify the relationship exists
    const branches = await employeeBranchesRepository.findByEmployeeId(employeeId)
    const exists = branches.some(b => b.branch_id === branchId)
    if (!exists) {
      throw new Error('Employee is not assigned to this branch')
    }

    await employeeBranchesRepository.setPrimaryBranch(employeeId, branchId)
    logInfo('Primary branch set', { employee_id: employeeId, branch_id: branchId })
  }

  async delete(id: string): Promise<void> {
    await employeeBranchesRepository.delete(id)
    logInfo('Employee branch deleted', { id })
  }

  async deleteByEmployeeAndBranch(employeeId: string, branchId: string): Promise<void> {
    await employeeBranchesRepository.deleteByEmployeeAndBranch(employeeId, branchId)
    logInfo('Employee branch deleted', { employee_id: employeeId, branch_id: branchId })
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await employeeBranchesRepository.bulkDelete(ids)
    logInfo('Bulk delete employee branches', { count: ids.length })
  }
}

export const employeeBranchesService = new EmployeeBranchesService()
