import { departmentsRepository } from './departments.repository'
import { DepartmentNotFoundError, DepartmentDuplicateError, DepartmentInUseError } from './departments.errors'
import { isPostgresError } from '../../utils/postgres-error.util'
import { AuditService } from '../monitoring/monitoring.service'
import type { Department, DepartmentWithCount, CreateDepartmentDto, UpdateDepartmentDto } from './departments.types'

class DepartmentsService {

  async list(companyIds: string[]): Promise<DepartmentWithCount[]> {
    return departmentsRepository.findAll(companyIds)
  }

  async getById(id: string, companyIds: string[]): Promise<Department> {
    const dept = await departmentsRepository.findByIdAccessible(id, companyIds)
    if (!dept) throw new DepartmentNotFoundError(id)
    return dept
  }

  async create(companyId: string, dto: CreateDepartmentDto): Promise<Department> {
    try {
      const dept = await departmentsRepository.create(companyId, dto)
      await AuditService.log('CREATE', 'department', dept.id, dto.created_by || '', undefined, dept)
      return dept
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new DepartmentDuplicateError(dto.department_code)
      throw err
    }
  }

  async update(id: string, companyId: string, dto: UpdateDepartmentDto, existing?: Department): Promise<Department> {
    const record = existing ?? await departmentsRepository.findById(id, companyId)
    if (!record) throw new DepartmentNotFoundError(id)

    const updated = await departmentsRepository.update(id, companyId, dto)
    if (!updated) throw new DepartmentNotFoundError(id)

    await AuditService.log('UPDATE', 'department', id, dto.updated_by || '', record, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string, existing?: Department): Promise<void> {
    const record = existing ?? await departmentsRepository.findById(id, companyId)
    if (!record) throw new DepartmentNotFoundError(id)

    const hasChildren = await departmentsRepository.hasChildren(id)
    if (hasChildren) throw new DepartmentInUseError()

    await departmentsRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'department', id, userId, record)
  }
}

export const departmentsService = new DepartmentsService()
