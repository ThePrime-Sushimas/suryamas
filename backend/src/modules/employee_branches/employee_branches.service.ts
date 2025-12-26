import { employeeBranchesRepository } from './employee_branches.repository'
import { EmployeeBranchErrors } from './employee_branches.errors'
import {
  EmployeeBranchDto,
  EmployeeBranchWithRelations,
  CreateEmployeeBranchData,
  UpdateEmployeeBranchData,
  PaginationParams,
  PaginatedResult,
  PaginationMeta
} from './employee_branches.types'
import { logInfo } from '../../config/logger'

export class EmployeeBranchesService {
  private toDto(entity: EmployeeBranchWithRelations): EmployeeBranchDto {
    return {
      id: entity.id,
      employee_id: entity.employee_id,
      branch_id: entity.branch_id,
      is_primary: entity.is_primary,
      employee_name: entity.employee.full_name,
      branch_name: entity.branch.branch_name,
      branch_code: entity.branch.branch_code,
      created_at: entity.created_at,
    }
  }

  private calculatePagination(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit)
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    }
  }

  async list(params: PaginationParams): Promise<PaginatedResult<EmployeeBranchDto>> {
    const offset = (params.page - 1) * params.limit
    const { data, total } = await employeeBranchesRepository.findAll(params.limit, offset)

    return {
      data: data.map(item => this.toDto(item)),
      pagination: this.calculatePagination(params.page, params.limit, total),
    }
  }

  async getByEmployeeId(employeeId: string): Promise<EmployeeBranchDto[]> {
    const data = await employeeBranchesRepository.findByEmployeeId(employeeId)
    return data.map(item => this.toDto(item))
  }

  async getById(id: string): Promise<EmployeeBranchDto> {
    const result = await employeeBranchesRepository.findById(id)
    if (!result) throw EmployeeBranchErrors.NOT_FOUND()
    return this.toDto(result)
  }

  async getByBranchId(branchId: string, params: PaginationParams): Promise<PaginatedResult<EmployeeBranchDto>> {
    const offset = (params.page - 1) * params.limit
    const { data, total } = await employeeBranchesRepository.findByBranchId(branchId, params.limit, offset)

    return {
      data: data.map(item => this.toDto(item)),
      pagination: this.calculatePagination(params.page, params.limit, total),
    }
  }

  async getPrimaryBranch(employeeId: string): Promise<EmployeeBranchDto | null> {
    const result = await employeeBranchesRepository.findPrimaryBranch(employeeId)
    return result ? this.toDto(result) : null
  }

  async create(data: CreateEmployeeBranchData): Promise<EmployeeBranchDto> {
    // Validate employee exists
    const employeeExists = await employeeBranchesRepository.employeeExists(data.employee_id)
    if (!employeeExists) throw EmployeeBranchErrors.EMPLOYEE_NOT_FOUND()

    // Validate branch exists
    const branchExists = await employeeBranchesRepository.branchExists(data.branch_id)
    if (!branchExists) throw EmployeeBranchErrors.BRANCH_NOT_FOUND()

    // Check if assignment already exists
    const existing = await employeeBranchesRepository.findByEmployeeAndBranch(data.employee_id, data.branch_id)
    if (existing) throw EmployeeBranchErrors.ALREADY_EXISTS()

    // Check if employee already has branches
    const currentBranches = await employeeBranchesRepository.findByEmployeeId(data.employee_id)
    
    // Determine if this should be primary
    let isPrimary = false
    if (currentBranches.length === 0) {
      // First branch is always primary
      isPrimary = true
    } else if (data.is_primary === true) {
      // User explicitly wants this as primary, unset others first
      await employeeBranchesRepository.unsetPrimaryForEmployee(data.employee_id)
      isPrimary = true
    }

    const created = await employeeBranchesRepository.create({
      employee_id: data.employee_id,
      branch_id: data.branch_id,
      is_primary: isPrimary,
    })

    logInfo('Employee branch created', { id: created.id, employee_id: data.employee_id, branch_id: data.branch_id })

    // Fetch with relations for response
    const result = await employeeBranchesRepository.findById(created.id)
    return this.toDto(result!)
  }

  async update(id: string, data: UpdateEmployeeBranchData): Promise<EmployeeBranchDto> {
    const existing = await employeeBranchesRepository.findById(id)
    if (!existing) throw EmployeeBranchErrors.NOT_FOUND()

    const updated = await employeeBranchesRepository.update(id, { is_primary: data.is_primary })
    if (!updated) throw EmployeeBranchErrors.NOT_FOUND()

    logInfo('Employee branch updated', { id })

    const result = await employeeBranchesRepository.findById(id)
    return this.toDto(result!)
  }

  async setPrimaryBranch(employeeId: string, branchId: string): Promise<void> {
    // Validate assignment exists
    const assignment = await employeeBranchesRepository.findByEmployeeAndBranch(employeeId, branchId)
    if (!assignment) throw EmployeeBranchErrors.NO_ASSIGNMENT()

    // Use atomic DB function for transaction safety
    await employeeBranchesRepository.setPrimaryBranch(employeeId, branchId)

    logInfo('Primary branch set', { employee_id: employeeId, branch_id: branchId })
  }

  async delete(id: string): Promise<void> {
    const existing = await employeeBranchesRepository.findById(id)
    if (!existing) throw EmployeeBranchErrors.NOT_FOUND()

    // Prevent deleting primary branch if other branches exist
    if (existing.is_primary) {
      const allBranches = await employeeBranchesRepository.findByEmployeeId(existing.employee_id)
      if (allBranches.length > 1) {
        throw EmployeeBranchErrors.CANNOT_DELETE_PRIMARY()
      }
    }

    await employeeBranchesRepository.delete(id)
    logInfo('Employee branch deleted', { id })
  }

  async deleteByEmployeeAndBranch(employeeId: string, branchId: string): Promise<void> {
    const assignment = await employeeBranchesRepository.findByEmployeeAndBranch(employeeId, branchId)
    if (!assignment) throw EmployeeBranchErrors.NOT_FOUND()

    // Prevent deleting primary branch if other branches exist
    if (assignment.is_primary) {
      const allBranches = await employeeBranchesRepository.findByEmployeeId(employeeId)
      if (allBranches.length > 1) {
        throw EmployeeBranchErrors.CANNOT_DELETE_PRIMARY()
      }
    }

    await employeeBranchesRepository.deleteByEmployeeAndBranch(employeeId, branchId)
    logInfo('Employee branch deleted', { employee_id: employeeId, branch_id: branchId })
  }

  async bulkDelete(ids: string[]): Promise<void> {
    // Validate all exist and check primary constraints
    for (const id of ids) {
      const existing = await employeeBranchesRepository.findById(id)
      if (existing && existing.is_primary) {
        const allBranches = await employeeBranchesRepository.findByEmployeeId(existing.employee_id)
        if (allBranches.length > 1) {
          throw EmployeeBranchErrors.CANNOT_DELETE_PRIMARY()
        }
      }
    }

    await employeeBranchesRepository.bulkDelete(ids)
    logInfo('Bulk delete employee branches', { count: ids.length })
  }
}

export const employeeBranchesService = new EmployeeBranchesService()
