import { supabase } from '../config/supabase'

const COMPANY_ID = '3576839e-d83a-4061-8551-fe9b5d971111'
const CREATED_BY = '8a130a3e-0490-48b9-abe5-769af0dee345'

interface SeedPurposeAccount {
  purpose_code: string
  account_code: string
  side: 'DEBIT' | 'CREDIT'
  priority: number
}

const purposeAccountMappings: SeedPurposeAccount[] = [
  // PUR-INV: Purchase Invoice — DR Inventory, CR AP
  { purpose_code: 'PUR-INV', account_code: '110501', side: 'DEBIT', priority: 1 },  // Raw material
  { purpose_code: 'PUR-INV', account_code: '210101', side: 'CREDIT', priority: 1 }, // Account payable purchase

  // PUR-PAY: Purchase Payment — DR AP, CR Bank
  { purpose_code: 'PUR-PAY', account_code: '210101', side: 'DEBIT', priority: 1 },  // Account payable purchase
  { purpose_code: 'PUR-PAY', account_code: '110201', side: 'CREDIT', priority: 1 }, // Bank BCA

  // SAL-INV: Sales Invoice — DR Receivable + Discount, CR Revenue + CR PB1
  { purpose_code: 'SAL-INV', account_code: '110301', side: 'DEBIT', priority: 1 },  // Cash sales receivable
  { purpose_code: 'SAL-INV', account_code: '410301', side: 'DEBIT', priority: 2 },  // Bill Discount (contra-revenue)
  { purpose_code: 'SAL-INV', account_code: '410304', side: 'DEBIT', priority: 3 },  // Promotion Discount
  { purpose_code: 'SAL-INV', account_code: '410305', side: 'DEBIT', priority: 4 },  // Voucher Discount
  { purpose_code: 'SAL-INV', account_code: '610801', side: 'DEBIT', priority: 5 },  // Rounding Expense
  { purpose_code: 'SAL-INV', account_code: '410101', side: 'CREDIT', priority: 1 }, // Sales - Food
  { purpose_code: 'SAL-INV', account_code: '210206', side: 'CREDIT', priority: 2 }, // Pb1 payable
  { purpose_code: 'SAL-INV', account_code: '210209', side: 'CREDIT', priority: 3 }, // SC Payable
  { purpose_code: 'SAL-INV', account_code: '210210', side: 'CREDIT', priority: 4 }, // Other VAT Payable
  { purpose_code: 'SAL-INV', account_code: '410202', side: 'CREDIT', priority: 5 }, // Order Fee Revenue
  { purpose_code: 'SAL-INV', account_code: '410203', side: 'CREDIT', priority: 6 }, // Delivery Revenue

  // SAL-REC: Sales Receipt — DR Cash/Bank, CR Receivable
  { purpose_code: 'SAL-REC', account_code: '110102', side: 'DEBIT', priority: 1 },  // Petty cash outlet
  { purpose_code: 'SAL-REC', account_code: '110301', side: 'CREDIT', priority: 1 }, // Cash sales receivable

  // INV-ADJ: Inventory Adjustment — DR COGS Variance, CR Inventory
  { purpose_code: 'INV-ADJ', account_code: '510301', side: 'DEBIT', priority: 1 },  // COGS Variance
  { purpose_code: 'INV-ADJ', account_code: '110501', side: 'CREDIT', priority: 1 }, // Raw material

  // EXP-SAL: Salary Expense — DR Salary, CR Salary payable
  { purpose_code: 'EXP-SAL', account_code: '610201', side: 'DEBIT', priority: 1 },  // Salary
  { purpose_code: 'EXP-SAL', account_code: '210301', side: 'CREDIT', priority: 1 }, // Salary payable

  // EXP-UTL: Utility Expense — DR Electricity + Water + Gas, CR Utilities payable
  { purpose_code: 'EXP-UTL', account_code: '610303', side: 'DEBIT', priority: 1 },  // Electricity Cost
  { purpose_code: 'EXP-UTL', account_code: '610304', side: 'DEBIT', priority: 2 },  // Water Cost
  { purpose_code: 'EXP-UTL', account_code: '610305', side: 'DEBIT', priority: 3 },  // Gas Cost
  { purpose_code: 'EXP-UTL', account_code: '210302', side: 'CREDIT', priority: 1 }, // Utilities payable

  // EXP-RNT: Rent Expense — DR Rent, CR Bank
  { purpose_code: 'EXP-RNT', account_code: '610301', side: 'DEBIT', priority: 1 },  // Eating House Rental
  { purpose_code: 'EXP-RNT', account_code: '110201', side: 'CREDIT', priority: 1 }, // Bank BCA

  // CSH-IN: Cash In — DR Petty cash, CR Misc Income
  { purpose_code: 'CSH-IN', account_code: '110101', side: 'DEBIT', priority: 1 },   // Petty cash HO
  { purpose_code: 'CSH-IN', account_code: '710109', side: 'CREDIT', priority: 1 },  // Miscellaneous Income/(Expense)

  // CSH-OUT: Cash Out — DR Misc Expense, CR Petty cash
  { purpose_code: 'CSH-OUT', account_code: '610708', side: 'DEBIT', priority: 1 },  // Miscellaneous Expense
  { purpose_code: 'CSH-OUT', account_code: '110101', side: 'CREDIT', priority: 1 }, // Petty cash HO

  // BNK-TRF: Bank Transfer — DR Bank Mandiri, CR Bank BCA
  { purpose_code: 'BNK-TRF', account_code: '110202', side: 'DEBIT', priority: 1 },  // Bank Mandiri
  { purpose_code: 'BNK-TRF', account_code: '110201', side: 'CREDIT', priority: 1 }, // Bank BCA

  // AST-PUR: Asset Purchase — DR Equipment, CR Bank
  { purpose_code: 'AST-PUR', account_code: '120103', side: 'DEBIT', priority: 1 },  // Equipment
  { purpose_code: 'AST-PUR', account_code: '110201', side: 'CREDIT', priority: 1 }, // Bank BCA

  // AST-DEP: Asset Depreciation — DR Depr Expense, CR Acc Depr
  { purpose_code: 'AST-DEP', account_code: '620103', side: 'DEBIT', priority: 1 },  // Depr - Equipment
  { purpose_code: 'AST-DEP', account_code: '120203', side: 'CREDIT', priority: 1 }, // Acc. Depr - Equipment
]

export async function seedAccountingPurposeAccounts() {
  try {
    console.log('🌱 Seeding accounting purpose accounts...')
    
    // Clear existing data
    await supabase
      .from('accounting_purpose_accounts')
      .delete()
      .eq('company_id', COMPANY_ID)
    
    // Get purpose and account IDs
    const { data: purposes } = await supabase
      .from('accounting_purposes')
      .select('id, purpose_code')
      .eq('company_id', COMPANY_ID)
    
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_code')
      .eq('company_id', COMPANY_ID)
    
    if (!purposes || !accounts) {
      throw new Error('Failed to fetch purposes or accounts')
    }
    
    // Create lookup maps
    const purposeMap = new Map(purposes.map(p => [p.purpose_code, p.id]))
    const accountMap = new Map(accounts.map(a => [a.account_code, a.id]))
    
    // Insert mappings
    let inserted = 0
    for (const mapping of purposeAccountMappings) {
      const purposeId = purposeMap.get(mapping.purpose_code)
      const accountId = accountMap.get(mapping.account_code)
      
      if (!purposeId || !accountId) {
        console.warn(`Skipping: ${mapping.purpose_code} - ${mapping.account_code} (not found)`)
        continue
      }
      
      const { error } = await supabase
        .from('accounting_purpose_accounts')
        .insert({
          company_id: COMPANY_ID,
          purpose_id: purposeId,
          account_id: accountId,
          side: mapping.side,
          priority: mapping.priority,
          is_required: true,
          is_auto: true,
          is_active: true,
          created_by: CREATED_BY,
          updated_by: CREATED_BY
        })
      
      if (error) {
        console.error(`Error inserting: ${mapping.purpose_code} - ${mapping.account_code}`, error)
      } else {
        inserted++
      }
    }
    
    console.log(`✅ Seeded ${inserted} accounting purpose account mappings`)
  } catch (error) {
    console.error('❌ Error seeding accounting purpose accounts:', error)
    throw error
  }
}
