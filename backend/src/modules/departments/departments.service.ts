import { departmentsRepository } from './departments.repository'
import { DepartmentNotFoundError, DepartmentDuplicateError, DepartmentInUseError } from './departments.errors'
import { isPostgresError } from '../../utils/postgres-error.util'
import { AuditService } from '../monitoring/monitoring.service'
import type { Department, DepartmentWithCount, CreateDepartmentDto, UpdateDepartmentDto } from './departments.types'

class DepartmentsService {

  async list(companyId: string): Promise<DepartmentWithCount[]> {
    return departmentsRepository.findAll(companyId)
  }

  async getById(id: string, companyId: string): Promise<Department> {
    const dept = await departmentsRepository.findById(id, companyId)
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

  async update(id: string, companyId: string, dto: UpdateDepartmentDto): Promise<Department> {
    const existing = await departmentsRepository.findById(id, companyId)
    if (!existing) throw new DepartmentNotFoundError(id)

    const updated = await departmentsRepository.update(id, companyId, dto)
    if (!updated) throw new DepartmentNotFoundError(id)

    await AuditService.log('UPDATE', 'department', id, dto.updated_by || '', existing, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    const existing = await departmentsRepository.findById(id, companyId)
    if (!existing) throw new DepartmentNotFoundError(id)

    const hasChildren = await departmentsRepository.hasChildren(id)
    if (hasChildren) throw new DepartmentInUseError()

    await departmentsRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'department', id, userId, existing)
  }
}

export const departmentsService = new DepartmentsService()
