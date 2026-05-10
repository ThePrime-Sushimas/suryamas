import { positionsRepository } from './positions.repository'
import { PositionNotFoundError, PositionDuplicateError, PositionInUseError } from './positions.errors'
import { isPostgresError } from '../../utils/postgres-error.util'
import { AuditService } from '../monitoring/monitoring.service'
import type { Position, PositionWithDepartment, CreatePositionDto, UpdatePositionDto } from './positions.types'

class PositionsService {

  async list(companyId: string, departmentId?: string): Promise<PositionWithDepartment[]> {
    return positionsRepository.findAll(companyId, departmentId)
  }

  async getById(id: string, companyId: string): Promise<Position> {
    const pos = await positionsRepository.findById(id, companyId)
    if (!pos) throw new PositionNotFoundError(id)
    return pos
  }

  async create(companyId: string, dto: CreatePositionDto): Promise<Position> {
    try {
      const pos = await positionsRepository.create(companyId, dto)
      await AuditService.log('CREATE', 'position', pos.id, dto.created_by || '', undefined, pos)
      return pos
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new PositionDuplicateError(dto.position_code)
      throw err
    }
  }

  async update(id: string, companyId: string, dto: UpdatePositionDto): Promise<Position> {
    const existing = await positionsRepository.findById(id, companyId)
    if (!existing) throw new PositionNotFoundError(id)

    const updated = await positionsRepository.update(id, companyId, dto)
    if (!updated) throw new PositionNotFoundError(id)

    await AuditService.log('UPDATE', 'position', id, dto.updated_by || '', existing, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    const existing = await positionsRepository.findById(id, companyId)
    if (!existing) throw new PositionNotFoundError(id)

    const hasChildren = await positionsRepository.hasChildren(id)
    if (hasChildren) throw new PositionInUseError()

    await positionsRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'position', id, userId, existing)
  }
}

export const positionsService = new PositionsService()
