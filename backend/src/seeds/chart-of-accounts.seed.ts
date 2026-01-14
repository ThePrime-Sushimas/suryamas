import { supabase } from '../config/supabase'

const COMPANY_ID = '3576839e-d83a-4061-8551-fe9b5d971111'
const CREATED_BY = '8a130a3e-0490-48b9-abe5-769af0dee345'

interface SeedAccount {
  company_id: string
  account_code: string
  account_name: string
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  normal_balance: 'DEBIT' | 'CREDIT'
  is_header: boolean
  is_postable: boolean
  currency_code: string
  parent_code?: string
  account_subtype?: string
}

const chartOfAccountsData: SeedAccount[] = [
  // ASSETS (1000-1999)
  { company_id: COMPANY_ID, account_code: '1000', account_name: 'ASET', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1100', account_name: 'ASET LANCAR', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '1000', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1110', account_name: 'Kas & Bank', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '1100', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1111', account_name: 'Kas', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '1110', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '11111', account_name: 'Kas Kecil', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1111', currency_code: 'IDR', account_subtype: 'CASH' },
  { company_id: COMPANY_ID, account_code: '11112', account_name: 'Kas Kasir', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1111', currency_code: 'IDR', account_subtype: 'CASH' },
  { company_id: COMPANY_ID, account_code: '1112', account_name: 'Bank', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '1110', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '11121', account_name: 'Bank BCA', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1112', currency_code: 'IDR', account_subtype: 'BANK' },
  { company_id: COMPANY_ID, account_code: '11122', account_name: 'Bank Mandiri', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1112', currency_code: 'IDR', account_subtype: 'BANK' },
  
  { company_id: COMPANY_ID, account_code: '1120', account_name: 'Piutang', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '1100', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1121', account_name: 'Piutang Usaha', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1120', currency_code: 'IDR', account_subtype: 'ACCOUNTS_RECEIVABLE' },
  { company_id: COMPANY_ID, account_code: '1122', account_name: 'Piutang Karyawan', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1120', currency_code: 'IDR', account_subtype: 'OTHER_RECEIVABLE' },
  
  { company_id: COMPANY_ID, account_code: '1130', account_name: 'Persediaan', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '1100', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1131', account_name: 'Persediaan Bahan Baku', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '1130', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '11311', account_name: 'Ikan Salmon', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1131', currency_code: 'IDR', account_subtype: 'INVENTORY' },
  { company_id: COMPANY_ID, account_code: '11312', account_name: 'Ikan Tuna', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1131', currency_code: 'IDR', account_subtype: 'INVENTORY' },
  { company_id: COMPANY_ID, account_code: '11313', account_name: 'Nori', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1131', currency_code: 'IDR', account_subtype: 'INVENTORY' },
  { company_id: COMPANY_ID, account_code: '11314', account_name: 'Beras Jepang', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1131', currency_code: 'IDR', account_subtype: 'INVENTORY' },
  { company_id: COMPANY_ID, account_code: '1132', account_name: 'Persediaan Bumbu & Saus', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1130', currency_code: 'IDR', account_subtype: 'INVENTORY' },
  { company_id: COMPANY_ID, account_code: '1133', account_name: 'Persediaan Minuman', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1130', currency_code: 'IDR', account_subtype: 'INVENTORY' },
  { company_id: COMPANY_ID, account_code: '1134', account_name: 'Persediaan Kemasan', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1130', currency_code: 'IDR', account_subtype: 'INVENTORY' },
  
  { company_id: COMPANY_ID, account_code: '1140', account_name: 'Pajak Dibayar Dimuka', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '1100', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1141', account_name: 'PPN Masukan', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1140', currency_code: 'IDR', account_subtype: 'TAX' },
  
  { company_id: COMPANY_ID, account_code: '1200', account_name: 'ASET TETAP', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '1000', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '1210', account_name: 'Peralatan Restoran', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1200', currency_code: 'IDR', account_subtype: 'FIXED_ASSET' },
  { company_id: COMPANY_ID, account_code: '1220', account_name: 'Peralatan Dapur', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1200', currency_code: 'IDR', account_subtype: 'FIXED_ASSET' },
  { company_id: COMPANY_ID, account_code: '1230', account_name: 'Furniture & Fixtures', account_type: 'ASSET', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '1200', currency_code: 'IDR', account_subtype: 'FIXED_ASSET' },
  { company_id: COMPANY_ID, account_code: '1240', account_name: 'Akumulasi Penyusutan', account_type: 'ASSET', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '1200', currency_code: 'IDR', account_subtype: 'ACCUMULATED_DEPRECIATION' },

  // LIABILITIES (2000-2999)
  { company_id: COMPANY_ID, account_code: '2000', account_name: 'KEWAJIBAN', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_header: true, is_postable: false, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '2100', account_name: 'KEWAJIBAN LANCAR', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_header: true, is_postable: false, parent_code: '2000', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '2110', account_name: 'Hutang Usaha', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '2100', currency_code: 'IDR', account_subtype: 'ACCOUNTS_PAYABLE' },
  { company_id: COMPANY_ID, account_code: '2120', account_name: 'Hutang Gaji', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '2100', currency_code: 'IDR', account_subtype: 'PAYROLL_PAYABLE' },
  { company_id: COMPANY_ID, account_code: '2130', account_name: 'PPN Keluaran', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '2100', currency_code: 'IDR', account_subtype: 'TAX' },
  { company_id: COMPANY_ID, account_code: '2131', account_name: 'PPh 21', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '2100', currency_code: 'IDR', account_subtype: 'TAX' },
  { company_id: COMPANY_ID, account_code: '2132', account_name: 'PPh 23', account_type: 'LIABILITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '2100', currency_code: 'IDR', account_subtype: 'TAX' },

  // EQUITY (3000-3999)
  { company_id: COMPANY_ID, account_code: '3000', account_name: 'EKUITAS', account_type: 'EQUITY', normal_balance: 'CREDIT', is_header: true, is_postable: false, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '3100', account_name: 'Modal Pemilik', account_type: 'EQUITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '3000', currency_code: 'IDR', account_subtype: 'CAPITAL' },
  { company_id: COMPANY_ID, account_code: '3200', account_name: 'Laba Ditahan', account_type: 'EQUITY', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '3000', currency_code: 'IDR', account_subtype: 'RETAINED_EARNINGS' },
  { company_id: COMPANY_ID, account_code: '3300', account_name: 'Prive', account_type: 'EQUITY', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '3000', currency_code: 'IDR', account_subtype: 'DRAWINGS' },

  // REVENUE (4000-4999)
  { company_id: COMPANY_ID, account_code: '4000', account_name: 'PENDAPATAN', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: true, is_postable: false, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '4100', account_name: 'Pendapatan Penjualan', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: true, is_postable: false, parent_code: '4000', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '4110', account_name: 'Penjualan Makanan', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: true, is_postable: false, parent_code: '4100', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '41101', account_name: 'Sushi', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '4110', currency_code: 'IDR', account_subtype: 'SALES' },
  { company_id: COMPANY_ID, account_code: '41102', account_name: 'Ramen', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '4110', currency_code: 'IDR', account_subtype: 'SALES' },
  { company_id: COMPANY_ID, account_code: '41103', account_name: 'Tempura', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '4110', currency_code: 'IDR', account_subtype: 'SALES' },
  { company_id: COMPANY_ID, account_code: '4120', account_name: 'Penjualan Minuman', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '4100', currency_code: 'IDR', account_subtype: 'SALES' },
  { company_id: COMPANY_ID, account_code: '4130', account_name: 'Service Charge', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '4100', currency_code: 'IDR', account_subtype: 'SERVICE_REVENUE' },
  { company_id: COMPANY_ID, account_code: '4200', account_name: 'Potongan Penjualan', account_type: 'REVENUE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '4000', currency_code: 'IDR', account_subtype: 'SALES_DISCOUNT' },
  { company_id: COMPANY_ID, account_code: '4300', account_name: 'Pendapatan Lain-lain', account_type: 'REVENUE', normal_balance: 'CREDIT', is_header: false, is_postable: true, parent_code: '4000', currency_code: 'IDR', account_subtype: 'OTHER_INCOME' },

  // EXPENSES (5000-6999)
  { company_id: COMPANY_ID, account_code: '5000', account_name: 'HARGA POKOK PENJUALAN', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: true, is_postable: false, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '5100', account_name: 'HPP Makanan', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '5000', currency_code: 'IDR', account_subtype: 'COGS' },
  { company_id: COMPANY_ID, account_code: '5200', account_name: 'HPP Minuman', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '5000', currency_code: 'IDR', account_subtype: 'COGS' },
  { company_id: COMPANY_ID, account_code: '5300', account_name: 'Selisih Persediaan', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '5000', currency_code: 'IDR', account_subtype: 'INVENTORY_ADJUSTMENT' },
  
  { company_id: COMPANY_ID, account_code: '6000', account_name: 'BEBAN OPERASIONAL', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: true, is_postable: false, currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '6100', account_name: 'Beban Gaji & Upah', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: true, is_postable: false, parent_code: '6000', currency_code: 'IDR' },
  { company_id: COMPANY_ID, account_code: '6110', account_name: 'Gaji Chef', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6100', currency_code: 'IDR', account_subtype: 'PAYROLL' },
  { company_id: COMPANY_ID, account_code: '6111', account_name: 'Gaji Waiters', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6100', currency_code: 'IDR', account_subtype: 'PAYROLL' },
  { company_id: COMPANY_ID, account_code: '6112', account_name: 'Gaji Kasir', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6100', currency_code: 'IDR', account_subtype: 'PAYROLL' },
  { company_id: COMPANY_ID, account_code: '6113', account_name: 'Gaji Manager', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6100', currency_code: 'IDR', account_subtype: 'PAYROLL' },
  
  { company_id: COMPANY_ID, account_code: '6200', account_name: 'Beban Sewa', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6000', currency_code: 'IDR', account_subtype: 'RENT' },
  { company_id: COMPANY_ID, account_code: '6300', account_name: 'Beban Listrik & Air', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6000', currency_code: 'IDR', account_subtype: 'UTILITIES' },
  { company_id: COMPANY_ID, account_code: '6400', account_name: 'Beban Gas', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6000', currency_code: 'IDR', account_subtype: 'UTILITIES' },
  { company_id: COMPANY_ID, account_code: '6500', account_name: 'Beban Perlengkapan', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6000', currency_code: 'IDR', account_subtype: 'SUPPLIES' },
  { company_id: COMPANY_ID, account_code: '6600', account_name: 'Beban Kebersihan', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6000', currency_code: 'IDR', account_subtype: 'CLEANING' },
  { company_id: COMPANY_ID, account_code: '6700', account_name: 'Beban Marketing', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6000', currency_code: 'IDR', account_subtype: 'MARKETING' },
  { company_id: COMPANY_ID, account_code: '6800', account_name: 'Beban Penyusutan', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6000', currency_code: 'IDR', account_subtype: 'DEPRECIATION' },
  { company_id: COMPANY_ID, account_code: '6900', account_name: 'Beban Lain-lain', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6000', currency_code: 'IDR', account_subtype: 'OTHER_EXPENSE' },
  { company_id: COMPANY_ID, account_code: '6910', account_name: 'Beban Bank', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_header: false, is_postable: true, parent_code: '6000', currency_code: 'IDR', account_subtype: 'BANK_CHARGES' }
]

export async function seedChartOfAccounts() {
  try {
    console.log('🌱 Seeding chart of accounts...')
    
    // Clear existing data
    await supabase
      .from('chart_of_accounts')
      .delete()
      .eq('company_id', COMPANY_ID)
    
    // Insert seed data with proper level calculation
    for (const account of chartOfAccountsData) {
      let level = 1
      let parent_account_id = null
      
      // Calculate level and get parent_account_id if parent_code exists
      if (account.parent_code) {
        const { data: parent } = await supabase
          .from('chart_of_accounts')
          .select('id, level')
          .eq('account_code', account.parent_code)
          .eq('company_id', COMPANY_ID)
          .single()
        
        if (parent) {
          parent_account_id = parent.id
          level = parent.level + 1
        }
      }
      
      const { error } = await supabase
        .from('chart_of_accounts')
        .insert({
          company_id: account.company_id,
          account_code: account.account_code,
          account_name: account.account_name,
          account_type: account.account_type,
          account_subtype: account.account_subtype,
          normal_balance: account.normal_balance,
          is_header: account.is_header,
          is_postable: account.is_postable,
          currency_code: account.currency_code,
          parent_account_id,
          level,
          is_active: true,
          created_by: CREATED_BY,
          updated_by: CREATED_BY
        })
      
      if (error) {
        console.error('Error inserting account:', account.account_code, error)
        throw error
      }
    }
    
    console.log(`✅ Seeded ${chartOfAccountsData.length} chart of accounts`)
  } catch (error) {
    console.error('❌ Error seeding chart of accounts:', error)
    throw error
  }
}