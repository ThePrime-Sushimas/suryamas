// =====================================================
// DEFAULT PERMISSIONS SEED SCRIPT
// =====================================================

import { supabase } from '../config/supabase'
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
      const { data: existing } = await supabase
        .from('perm_roles')
        .select('*')
        .eq('name', roleData.name)
        .single()

      if (existing) {
        logInfo('Role already exists', { role: roleData.name })
        createdRoles.push(existing)
      } else {
        const { data: role, error } = await supabase
          .from('perm_roles')
          .insert(roleData)
          .select()
          .single()

        if (error) throw error

        logInfo('Role created', { role: roleData.name, id: role.id })
        createdRoles.push(role)
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
    ]

    const createdModules: any[] = []

    for (const moduleData of defaultModules) {
      // Check if exists
      const { data: existing } = await supabase
        .from('perm_modules')
        .select('*')
        .eq('name', moduleData.name)
        .single()

      if (existing) {
        logInfo('Module already exists', { module: moduleData.name })
        createdModules.push(existing)
      } else {
        const { data: module, error } = await supabase
          .from('perm_modules')
          .insert(moduleData)
          .select()
          .single()

        if (error) throw error

        logInfo('Module created', { module: moduleData.name, id: module.id })
        createdModules.push(module)
      }
    }

    // =====================================================
    // 3. CREATE DEFAULT PERMISSIONS
    // =====================================================
    const permissions: any[] = []

    for (const role of createdRoles) {
      for (const module of createdModules) {
        // Check if permission exists
        const { data: existing } = await supabase
          .from('perm_role_permissions')
          .select('*')
          .eq('role_id', role.id)
          .eq('module_id', module.id)
          .single()

        if (!existing) {
          permissions.push({
            role_id: role.id,
            module_id: module.id,
            ...createDefaultPermissions(),
          })
        }
      }
    }

    if (permissions.length > 0) {
      const { error } = await supabase.from('perm_role_permissions').insert(permissions)

      if (error) throw error

      logInfo('Permissions created', { count: permissions.length })
    } else {
      logInfo('All permissions already exist')
    }

    // =====================================================
    // 4. SUMMARY
    // =====================================================
    const summary = {
      roles: createdRoles.map((r) => r.name),
      modules: createdModules.map((m) => m.name),
      permissionsCreated: permissions.length,
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
