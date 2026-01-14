import 'dotenv/config'
import { supabase } from '../config/supabase'

const COMPANY_ID = '3576839e-d83a-4061-8551-fe9b5d971111'

async function verifySeed() {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('account_code, account_name, level, is_header')
    .eq('company_id', COMPANY_ID)
    .eq('level', 1)
    .order('account_code')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('\n📊 Level 1 Accounts (Main Categories):')
  console.log('=====================================')
  data?.forEach(acc => {
    console.log(`${acc.account_code} - ${acc.account_name} (Header: ${acc.is_header})`)
  })
  console.log(`\nTotal Level 1: ${data?.length}`)
}

verifySeed().then(() => process.exit(0))
