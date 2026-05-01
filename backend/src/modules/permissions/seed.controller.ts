import { Request, Response } from 'express'
import { RolesRepository } from './roles.repository'
import { PermissionService as CorePermissionService } from '../../services/permission.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'

export class SeedController {
  private rolesRepo = new RolesRepository()

  seedDefaults = async (req: Request, res: Response) => {
    try {
      logInfo('Starting permission seed...')

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

      const defaultModules = [
        { name: 'employees', description: 'Employee Management' },
        { name: 'permissions', description: 'Permission Management' },
        { name: 'companies', description: 'Company Management' },
        { name: 'branches', description: 'Branch Management' },
        { name: 'categories', description: 'Category Management' },
        { name: 'sub_categories', description: 'Sub Category Management' },
        { name: 'metric_units', description: 'Metric Units Management' },
        { name: 'payment_terms', description: 'Payment Terms Management' },
        { name: 'payment_methods', description: 'Payment Methods Management' },
        { name: 'products', description: 'Product Management' },
        { name: 'product_uoms', description: 'Product UOM Management' },
        { name: 'suppliers', description: 'Supplier Management' },
        { name: 'supplier_products', description: 'Supplier Product Management' },
        { name: 'pricelists', description: 'Pricelist Management' },
        { name: 'users', description: 'User Management' },
        { name: 'chart_of_accounts', description: 'Chart of Accounts Management' },
        { name: 'accounting_purposes', description: 'Accounting Purposes Management' },
        { name: 'accounting_purpose_accounts', description: 'Accounting Purpose Accounts Management' },
        { name: 'fiscal_periods', description: 'Fiscal Periods Management' },
        { name: 'pos_imports', description: 'POS Imports Management' },
        { name: 'jobs', description: 'Background Jobs Management' },
      ]

      for (const moduleData of defaultModules) {
        await CorePermissionService.registerModule(moduleData.name, moduleData.description)
      }

      logInfo('Permission seed completed')
      sendSuccess(res, { success: true }, 'Default permissions seeded successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'seed_defaults' })
    }
  }
}
