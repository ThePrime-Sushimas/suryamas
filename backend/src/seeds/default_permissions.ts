// =====================================================
// DEFAULT PERMISSIONS SEED SCRIPT
// =====================================================

import { pool } from '../config/db'
import { logInfo, logError } from '../config/logger'
import { createDefaultPermissions } from '../utils/permissions.util'

interface SeedResult {
  success: boolean
  message: string
  details?: any
}

/**
 * Seed default roles, modules, and permissions
 */
export async function seedDefaultPermissions(): Promise<SeedResult> {
  try {
    logInfo('Starting permission seed...')

    // =====================================================
    // 1. CREATE DEFAULT ROLES
    // =====================================================
    const defaultRoles = [
      {
        name: 'admin',
        description: 'System Administrator - Full access to all modules',
        is_system_role: true,
      },
      {
        name: 'manager',
        description: 'Manager - Can view, create, update, approve, and release',
        is_system_role: true,
      },
      {
        name: 'staff',
        description: 'Staff Member - Can view, create, and update',
        is_system_role: true,
      },
    ]

    const createdRoles: any[] = []

    for (const roleData of defaultRoles) {
      // Check if exists
      const { rows: existing } = await pool.query(
        `SELECT * FROM perm_roles WHERE name = $1 LIMIT 1`,
        [roleData.name]
      )

      if (existing[0]) {
        logInfo('Role already exists', { role: roleData.name })
        createdRoles.push(existing[0])
      } else {
        const { rows: role } = await pool.query(
          `INSERT INTO perm_roles (name, description, is_system_role) VALUES ($1, $2, $3) RETURNING *`,
          [roleData.name, roleData.description, roleData.is_system_role]
        )

        logInfo('Role created', { role: roleData.name, id: role[0].id })
        createdRoles.push(role[0])
      }
    }

    // =====================================================
    // 2. CREATE DEFAULT MODULES
    // =====================================================
    const defaultModules = [
      {
        name: 'employees',
        description: 'Employee Management System',
        is_active: true,
      },
      {
        name: 'permissions',
        description: 'Permission Management System',
        is_active: true,
      },
      {
        name: 'users',
        description: 'User Management System',
        is_active: true,
      },
      {
        name: 'jobs',
        description: 'Job Queue Management System',
        is_active: true,
      },
      {
        name: 'companies',
        description: 'Company Management System',
        is_active: true,
      },
      {
        name: 'products',
        description: 'Product Management System',
        is_active: true,
      },
      {
        name: 'categories',
        description: 'Category Management System',
        is_active: true,
      },
      {
        name: 'chart_of_accounts',
        description: 'Chart of Accounts Management',
        is_active: true,
      },
      {
        name: 'accounting_purposes',
        description: 'Accounting Purposes Management',
        is_active: true,
      },
    ]

    const createdModules: any[] = []

    for (const moduleData of defaultModules) {
      // Check if exists
      const { rows: existing } = await pool.query(
        `SELECT * FROM perm_modules WHERE name = $1 LIMIT 1`,
        [moduleData.name]
      )

      if (existing[0]) {
        logInfo('Module already exists', { module: moduleData.name })
        createdModules.push(existing[0])
      } else {
        const { rows: module } = await pool.query(
          `INSERT INTO perm_modules (name, description, is_active) VALUES ($1, $2, $3) RETURNING *`,
          [moduleData.name, moduleData.description, moduleData.is_active]
        )

        logInfo('Module created', { module: moduleData.name, id: module[0].id })
        createdModules.push(module[0])
      }
    }

    // =====================================================
    // 3. CREATE DEFAULT PERMISSIONS
    // =====================================================
    let permissionsInserted = 0

    for (const role of createdRoles) {
      for (const module of createdModules) {
        // Check if permission exists
        const { rows: existing } = await pool.query(
          `SELECT * FROM perm_role_permissions WHERE role_id = $1 AND module_id = $2 LIMIT 1`,
          [role.id, module.id]
        )

        if (!existing[0]) {
          const permissions = createDefaultPermissions(role.name)
          await pool.query(
            `INSERT INTO perm_role_permissions (role_id, module_id, can_view, can_insert, can_update, can_delete, can_approve, can_release) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [role.id, module.id, permissions.can_view, permissions.can_insert, permissions.can_update, permissions.can_delete, permissions.can_approve, permissions.can_release]
          )
          permissionsInserted++
        }
      }
    }

    if (permissionsInserted > 0) {
      logInfo('Permissions created', { count: permissionsInserted })
    } else {
      logInfo('All permissions already exist')
    }

    // =====================================================
    // 4. SUMMARY
    // =====================================================
    const summary = {
      roles: createdRoles.map((r) => r.name),
      modules: createdModules.map((m) => m.name),
      permissionsCreated: permissionsInserted,
    }

    logInfo('Permission seed completed', summary)

    return {
      success: true,
      message: 'Default permissions seeded successfully',
      details: summary,
    }
  } catch (error: any) {
    logError('Permission seed failed', { error: error.message })
    return {
      success: false,
      message: `Seed failed: ${error.message}`,
    }
  }
}

/**
 * Run seed if called directly
 */
if (require.main === module) {
  seedDefaultPermissions()
    .then((result) => {
      console.log('\n✅ Seed Result:', result)
      process.exit(result.success ? 0 : 1)
    })
    .catch((error) => {
      console.error('\n❌ Seed Error:', error)
      process.exit(1)
    })
}