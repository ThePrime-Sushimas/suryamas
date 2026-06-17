// =====================================================
// FIXED ASSETS SEED SCRIPT
// Seed permissions and default asset categories
// =====================================================

import 'dotenv/config'
import { pool } from '../config/db'
import { logInfo, logError } from '../config/logger'

interface SeedResult {
  success: boolean
  message: string
  details?: any
}

/**
 * Default asset categories to seed per company.
 * COA IDs are looked up dynamically by account_code.
 */
const DEFAULT_CATEGORIES = [
  {
    category_code: 'BLD',
    category_name: 'Bangunan',
    asset_coa_code: '120101',
    depreciation_expense_coa_code: '620101',
    accumulated_depreciation_coa_code: '120201',
    default_useful_life_months: 240,
  },
  {
    category_code: 'RNV',
    category_name: 'Renovasi',
    asset_coa_code: '120102',
    depreciation_expense_coa_code: '620102',
    accumulated_depreciation_coa_code: '120202',
    default_useful_life_months: 60,
  },
  {
    category_code: 'PRL',
    category_name: 'Peralatan',
    asset_coa_code: '120103',
    depreciation_expense_coa_code: '620103',
    accumulated_depreciation_coa_code: '120203',
    default_useful_life_months: 60,
  },
  {
    category_code: 'VCL',
    category_name: 'Kendaraan',
    asset_coa_code: '120104',
    depreciation_expense_coa_code: '620104',
    accumulated_depreciation_coa_code: '120204',
    default_useful_life_months: 60,
  },
]

/**
 * Seed the fixed_assets module permission and assign to all existing roles.
 */
async function seedFixedAssetsPermissions(): Promise<number> {
  // 1. Create the module entry (idempotent)
  const { rows: moduleRows } = await pool.query(
    `INSERT INTO perm_modules (name, description, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
     RETURNING id`,
    ['fixed_assets', 'Fixed Asset Management']
  )
  const moduleId = moduleRows[0].id
  logInfo('Fixed assets module registered', { moduleId })

  // 2. Assign permissions to all existing roles
  const { rows: roles } = await pool.query(`SELECT id, name FROM perm_roles`)

  let permissionsCreated = 0
  for (const role of roles) {
    // Determine permission levels based on role
    let canView = true
    let canInsert = false
    let canUpdate = false
    let canDelete = false
    let canApprove = false
    const canRelease = false

    if (role.name === 'admin') {
      canInsert = true
      canUpdate = true
      canDelete = true
      canApprove = true
    } else if (role.name === 'manager') {
      canInsert = true
      canUpdate = true
      canApprove = true
    } else if (role.name === 'staff') {
      canInsert = true
      canUpdate = true
    }

    const { rowCount } = await pool.query(
      `INSERT INTO perm_role_permissions (role_id, module_id, can_view, can_insert, can_update, can_delete, can_approve, can_release)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (role_id, module_id) DO NOTHING`,
      [role.id, moduleId, canView, canInsert, canUpdate, canDelete, canApprove, canRelease]
    )
    if (rowCount && rowCount > 0) permissionsCreated++
  }

  return permissionsCreated
}

/**
 * Seed default asset categories for all companies.
 * Looks up COA IDs by account_code per company.
 * Skips categories where required COA accounts are not found.
 */
async function seedDefaultCategories(): Promise<{ inserted: number; skipped: number }> {
  // Get all companies
  const { rows: companies } = await pool.query(`SELECT id FROM companies WHERE deleted_at IS NULL`)

  let inserted = 0
  let skipped = 0

  for (const company of companies) {
    // Build a COA lookup map for this company
    const { rows: accounts } = await pool.query(
      `SELECT id, account_code FROM chart_of_accounts WHERE company_id = $1 AND deleted_at IS NULL`,
      [company.id]
    )
    const coaMap = new Map(accounts.map((a: any) => [a.account_code, a.id]))

    for (const category of DEFAULT_CATEGORIES) {
      const assetCoaId = coaMap.get(category.asset_coa_code)
      const depreciationExpenseCoaId = coaMap.get(category.depreciation_expense_coa_code)
      const accumulatedDepreciationCoaId = coaMap.get(category.accumulated_depreciation_coa_code)

      // Skip if any required COA is missing for this company
      if (!assetCoaId || !depreciationExpenseCoaId || !accumulatedDepreciationCoaId) {
        logInfo('Skipping category - COA not found', {
          companyId: company.id,
          categoryCode: category.category_code,
          missingCoas: {
            asset: !assetCoaId ? category.asset_coa_code : null,
            expense: !depreciationExpenseCoaId ? category.depreciation_expense_coa_code : null,
            accumulated: !accumulatedDepreciationCoaId ? category.accumulated_depreciation_coa_code : null,
          },
        })
        skipped++
        continue
      }

      const { rowCount } = await pool.query(
        `INSERT INTO asset_categories (
          company_id, category_code, category_name,
          asset_coa_id, depreciation_expense_coa_id, accumulated_depreciation_coa_id,
          default_useful_life_months, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        ON CONFLICT (company_id, category_code) DO NOTHING`,
        [
          company.id,
          category.category_code,
          category.category_name,
          assetCoaId,
          depreciationExpenseCoaId,
          accumulatedDepreciationCoaId,
          category.default_useful_life_months,
        ]
      )
      if (rowCount && rowCount > 0) inserted++
    }
  }

  return { inserted, skipped }
}

/**
 * Main seed function for fixed assets module.
 */
export async function seedFixedAssets(): Promise<SeedResult> {
  try {
    logInfo('Starting fixed assets seed...')

    // 1. Seed permissions
    const permissionsCreated = await seedFixedAssetsPermissions()
    logInfo('Fixed assets permissions seeded', { permissionsCreated })

    // 2. Seed default categories
    const { inserted, skipped } = await seedDefaultCategories()
    logInfo('Default asset categories seeded', { inserted, skipped })

    const summary = {
      permissionsCreated,
      categoriesInserted: inserted,
      categoriesSkipped: skipped,
    }

    logInfo('Fixed assets seed completed', summary)

    return {
      success: true,
      message: 'Fixed assets seed completed successfully',
      details: summary,
    }
  } catch (error: any) {
    logError('Fixed assets seed failed', { error: error.message })
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
  seedFixedAssets()
    .then((result) => {
      console.log('\n✅ Seed Result:', result)
      process.exit(result.success ? 0 : 1)
    })
    .catch((error) => {
      console.error('\n❌ Seed Error:', error)
      process.exit(1)
    })
}
