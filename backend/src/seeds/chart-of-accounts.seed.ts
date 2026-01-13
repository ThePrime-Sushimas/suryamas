import { supabase } from '../config/supabase'
import { CreateChartOfAccountDTO } from '../modules/accounting/chart-of-accounts/chart-of-accounts.types'

const COMPANY_ID = '3576839e-d83a-4061-8551-fe9b5d971111'
const CREATED_BY = '8a130a3e-0490-48b9-abe5-769af0dee345'

const chartOfAccountsData: CreateChartOfAccountDTO[] = [
  // ASSETS (1000-1999)
  { company_id: COMPANY_ID, account_code: '1000', account_name: 'Cash on Hand', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1050', account_name: 'Petty Cash', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1100', account_name: 'Bank Account - Main', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1200', account_name: 'Accounts Receivable', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1300', account_name: 'Inventory', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1400', account_name: 'Tax Receivable', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },

  // LIABILITIES (2000-2999)
  { company_id: COMPANY_ID, account_code: '2100', account_name: 'Accounts Payable', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '2300', account_name: 'Tax Payable', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, currency_code: 'IDR' },

  // EQUITY (3000-3999)
  { company_id: COMPANY_ID, account_code: '3000', account_name: 'Owner Capital', account_type: 'EQUITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, currency_code: 'IDR' },

  // REVENUE (4000-4999)
  { company_id: COMPANY_ID, account_code: '4000', account_name: 'Sales Revenue', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '4100', account_name: 'Sales Discount', account_type: 'REVENUE', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '4200', account_name: 'Sales Returns', account_type: 'REVENUE', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '4300', account_name: 'Interest Income', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: false, is_postable: true, currency_code: 'IDR' },

  // EXPENSES (5000-6999)
  { company_id: COMPANY_ID, account_code: '5000', account_name: 'Cost of Goods Sold', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '5100', account_name: 'Purchase Discount', account_type: 'EXPENSE', normal_balance: 'CREDIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '5200', account_name: 'Purchase Returns', account_type: 'EXPENSE', normal_balance: 'CREDIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '5300', account_name: 'Inventory Adjustment', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '5400', account_name: 'Inventory Shrinkage', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '6100', account_name: 'Bank Fees', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, currency_code: 'IDR' }
]

export async function seedChartOfAccounts() {
  try {
    console.log('🌱 Seeding chart of accounts...')
    
    // Clear existing data
    await supabase
      .from('chart_of_accounts')
      .delete()
      .eq('company_id', COMPANY_ID)
    
    // Insert seed data
    for (const account of chartOfAccountsData) {
      const { error } = await supabase
        .from('chart_of_accounts')
        .insert({
          company_id: account.company_id,
          account_code: account.account_code,
          account_name: account.account_name,
          account_type: account.account_type,
          normal_balance: account.normal_balance,
          is_header: account.is_header,
          is_postable: account.is_postable,
          currency_code: account.currency_code,
          level: 1,
          is_active: true,
          created_by: CREATED_BY,
          updated_by: CREATED_BY
        })
      
      if (error) {
        console.error('Error inserting account:', error)
        throw error
      }
    }
    
    console.log(`✅ Seeded ${chartOfAccountsData.length} chart of accounts`)
  } catch (error) {
    console.error('❌ Error seeding chart of accounts:', error)
    throw error
  }
}