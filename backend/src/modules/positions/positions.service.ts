import { positionsRepository } from './positions.repository'
import { PositionNotFoundError, PositionDuplicateError, PositionInUseError } from './positions.errors'
import { isPostgresError } from '../../utils/postgres-error.util'
import { AuditService } from '../monitoring/monitoring.service'
import { RolesService } from '../permissions/roles.service'
import { pool } from '../../config/db'
import type { Position, PositionWithDepartment, CreatePositionDto, UpdatePositionDto } from './positions.types'

class PositionsService {

  async list(companyIds: string[], departmentId?: string): Promise<PositionWithDepartment[]> {
    return positionsRepository.findAll(companyIds, departmentId)
  }

  async getById(id: string, companyIds: string[]): Promise<Position> {
    const pos = await positionsRepository.findByIdAccessible(id, companyIds)
    if (!pos) throw new PositionNotFoundError(id)
    return pos
  }

  async create(companyId: string, dto: CreatePositionDto): Promise<Position> {
    try {
      const rolesService = new RolesService()
      let roleId: string

      // Try to find if a role with this name already exists (LOWER case-insensitive query)
      const { rows: existingRoles } = await pool.query(
        'SELECT id FROM perm_roles WHERE LOWER(name) = LOWER($1) LIMIT 1',
        [dto.position_name]
      )

      if (existingRoles.length > 0) {
        roleId = existingRoles[0].id
      } else {
        const createdRole = await rolesService.create({
          name: dto.position_name,
          description: `Auto-generated role for Position: ${dto.position_name}`
        }, dto.created_by)
        roleId = createdRole.id
      }

      const pos = await positionsRepository.create(companyId, { ...dto, role_id: roleId })
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

    let roleId = existing.role_id

    // If position_name is changing, update the matching role name too
    if (dto.position_name && dto.position_name !== existing.position_name && existing.role_id) {
      const rolesService = new RolesService()
      await rolesService.update(existing.role_id, { name: dto.position_name })
    }

    const updated = await positionsRepository.update(id, companyId, { ...dto, role_id: roleId ?? undefined })
    if (!updated) throw new PositionNotFoundError(id)

    await AuditService.log('UPDATE', 'position', id, dto.updated_by || '', existing, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    const existing = await positionsRepository.findById(id, companyId)
    if (!existing) throw new PositionNotFoundError(id)

    const hasChildren = await positionsRepository.hasChildren(id)
    if (hasChildren) throw new PositionInUseError()

    // Soft delete auto-generated role (is_active = false) — keep for historical data
    if (existing.role_id) {
      await pool.query(
        `UPDATE perm_roles SET is_active = false WHERE id = $1`,
        [existing.role_id]
      )
    }

    await positionsRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'position', id, userId, existing)
  }
}

export const positionsService = new PositionsService()
