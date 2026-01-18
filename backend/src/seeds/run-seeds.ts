/**
 * Run All Seeds
 * Execute all seed scripts to initialize database
 */

import { seedDefaultPermissions } from './default_permissions'
import { logInfo } from '../config/logger'

async function runAllSeeds() {
  try {
    logInfo('========================================')
    logInfo('Starting database seeding...')
    logInfo('========================================')

    // Run permission seed
    const permResult = await seedDefaultPermissions()
    console.log('\n✅ Permission Seed:', permResult.message)

    logInfo('========================================')
    logInfo('All seeds completed successfully!')
    logInfo('========================================')

    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Seed Error:', error.message)
    logInfo('Seed process failed', { error: error.message })
    process.exit(1)
  }
}

runAllSeeds()

