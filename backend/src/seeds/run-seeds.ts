import 'dotenv/config'
import { seedChartOfAccounts } from './chart-of-accounts.seed'
import { seedAccountingPurposes } from './accounting-purposes.seed'
import { seedAccountingPurposeAccounts } from './accounting-purpose-accounts.seed'

async function runSeeds() {
  try {
    console.log('🚀 Starting seed process...\n')
    
    await seedChartOfAccounts()
    await seedAccountingPurposes()
    await seedAccountingPurposeAccounts()
    
    console.log('\n✅ All seeds completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Seed process failed:', error)
    process.exit(1)
  }
}

runSeeds()
