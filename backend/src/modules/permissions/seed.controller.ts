// =====================================================
// SEED CONTROLLER
// Responsibility: Database seeding for default data
// =====================================================

import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { RolesRepository } from './roles.repository'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError } from '../../config/logger'

export class SeedController {
  private rolesRepo: RolesRepository

  constructor() {
    this.rolesRepo = new RolesRepository()
  }

  seedDefaults = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      logInfo('Starting permission seed...')

      // Create default roles
      const defaultRoles = [
        { name: 'admin', description: 'System Administrator', is_system_role: true },
        { name: 'manager', description: 'Manager', is_system_role: true },
        { name: 'staff', description: 'Staff Member', is_system_role: true },
      ]

      for (const roleData of defaultRoles) {
        const existing = await this.rolesRepo.getByName(roleData.name)
        if (!existing) {
          await this.rolesRepo.create(roleData)
          logInfo('Default role created', { role: roleData.name })
        }
      }

      // Register default modules
      const defaultModules = [
        { name: 'employees', description: 'Employee Management' },
        { name: 'permissions', description: 'Permission Management' },
      ]

      for (const moduleData of defaultModules) {
        await CorePermissionService.registerModule(moduleData.name, moduleData.description)
      }

      logInfo('Permission seed completed')
      sendSuccess(res, { success: true, message: 'Default permissions seeded successfully' }, 'Default permissions seeded successfully')
    } catch (error: any) {
      logError('Seed defaults failed', { error: error.message })
      sendError(res, 'Failed to seed default permissions', 500)
    }
  }
}
