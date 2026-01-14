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
  // PUR-INV: Purchase Invoice (Pembelian)
  { purpose_code: 'PUR-INV', account_code: '1131', side: 'DEBIT', priority: 1 },  // Persediaan Bahan Baku
  { purpose_code: 'PUR-INV', account_code: '1141', side: 'DEBIT', priority: 2 },  // PPN Masukan
  { purpose_code: 'PUR-INV', account_code: '2110', side: 'CREDIT', priority: 1 }, // Hutang Usaha
  
  // PUR-PAY: Purchase Payment (Bayar Hutang)
  { purpose_code: 'PUR-PAY', account_code: '2110', side: 'DEBIT', priority: 1 },  // Hutang Usaha
  { purpose_code: 'PUR-PAY', account_code: '11121', side: 'CREDIT', priority: 1 }, // Bank BCA
  
  // SAL-INV: Sales Invoice (Penjualan)
  { purpose_code: 'SAL-INV', account_code: '1121', side: 'DEBIT', priority: 1 },  // Piutang Usaha
  { purpose_code: 'SAL-INV', account_code: '41101', side: 'CREDIT', priority: 1 }, // Penjualan Sushi
  { purpose_code: 'SAL-INV', account_code: '2130', side: 'CREDIT', priority: 2 }, // PPN Keluaran
  
  // SAL-REC: Sales Receipt (Terima Pembayaran)
  { purpose_code: 'SAL-REC', account_code: '11112', side: 'DEBIT', priority: 1 }, // Kas Kasir
  { purpose_code: 'SAL-REC', account_code: '1121', side: 'CREDIT', priority: 1 }, // Piutang Usaha
  
  // INV-ADJ: Inventory Adjustment (Penyesuaian Stok)
  { purpose_code: 'INV-ADJ', account_code: '5300', side: 'DEBIT', priority: 1 },  // Selisih Persediaan
  { purpose_code: 'INV-ADJ', account_code: '1131', side: 'CREDIT', priority: 1 }, // Persediaan Bahan Baku
  
  // EXP-SAL: Salary Expense (Gaji)
  { purpose_code: 'EXP-SAL', account_code: '6110', side: 'DEBIT', priority: 1 },  // Gaji Chef
  { purpose_code: 'EXP-SAL', account_code: '2120', side: 'CREDIT', priority: 1 }, // Hutang Gaji
  { purpose_code: 'EXP-SAL', account_code: '11121', side: 'CREDIT', priority: 2 }, // Bank BCA
  
  // EXP-UTL: Utility Expense (Listrik, Air, Gas)
  { purpose_code: 'EXP-UTL', account_code: '6300', side: 'DEBIT', priority: 1 },  // Beban Listrik & Air
  { purpose_code: 'EXP-UTL', account_code: '6400', side: 'DEBIT', priority: 2 },  // Beban Gas
  { purpose_code: 'EXP-UTL', account_code: '11121', side: 'CREDIT', priority: 1 }, // Bank BCA
  
  // EXP-RNT: Rent Expense (Sewa)
  { purpose_code: 'EXP-RNT', account_code: '6200', side: 'DEBIT', priority: 1 },  // Beban Sewa
  { purpose_code: 'EXP-RNT', account_code: '11121', side: 'CREDIT', priority: 1 }, // Bank BCA
  
  // CSH-IN: Cash In (Penerimaan Kas)
  { purpose_code: 'CSH-IN', account_code: '11111', side: 'DEBIT', priority: 1 },  // Kas Kecil
  { purpose_code: 'CSH-IN', account_code: '4300', side: 'CREDIT', priority: 1 },  // Pendapatan Lain-lain
  
  // CSH-OUT: Cash Out (Pengeluaran Kas)
  { purpose_code: 'CSH-OUT', account_code: '6900', side: 'DEBIT', priority: 1 },  // Beban Lain-lain
  { purpose_code: 'CSH-OUT', account_code: '11111', side: 'CREDIT', priority: 1 }, // Kas Kecil
  
  // BNK-TRF: Bank Transfer
  { purpose_code: 'BNK-TRF', account_code: '11122', side: 'DEBIT', priority: 1 }, // Bank Mandiri
  { purpose_code: 'BNK-TRF', account_code: '11121', side: 'CREDIT', priority: 1 }, // Bank BCA
  
  // AST-PUR: Asset Purchase (Beli Aset)
  { purpose_code: 'AST-PUR', account_code: '1210', side: 'DEBIT', priority: 1 },  // Peralatan Restoran
  { purpose_code: 'AST-PUR', account_code: '11121', side: 'CREDIT', priority: 1 }, // Bank BCA
  
  // AST-DEP: Asset Depreciation (Penyusutan)
  { purpose_code: 'AST-DEP', account_code: '6800', side: 'DEBIT', priority: 1 },  // Beban Penyusutan
  { purpose_code: 'AST-DEP', account_code: '1240', side: 'CREDIT', priority: 1 }, // Akumulasi Penyusutan
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
