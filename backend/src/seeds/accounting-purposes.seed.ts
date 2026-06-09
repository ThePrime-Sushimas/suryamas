import { pool } from '../config/db'

const COMPANY_ID = '3576839e-d83a-4061-8551-fe9b5d971111'
const CREATED_BY = '8a130a3e-0490-48b9-abe5-769af0dee345'

interface SeedPurpose {
  company_id: string
  purpose_code: string
  purpose_name: string
  description: string
  applied_to: string
  is_system: boolean
  is_active: boolean
}

const accountingPurposesData: SeedPurpose[] = [
  // Purchase Related
  { company_id: COMPANY_ID, purpose_code: 'PUR-INV', purpose_name: 'Purchase Invoice', description: 'Pembelian bahan baku dan supplies', applied_to: 'PURCHASE', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'PUR-RET', purpose_name: 'Purchase Return', description: 'Retur pembelian', applied_to: 'PURCHASE', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'PUR-PAY', purpose_name: 'Purchase Payment', description: 'Pembayaran hutang supplier', applied_to: 'PURCHASE', is_system: true, is_active: true },
  
  // Sales Related
  { company_id: COMPANY_ID, purpose_code: 'SAL-INV', purpose_name: 'Sales Invoice', description: 'Penjualan makanan dan minuman', applied_to: 'SALES', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'SAL-RET', purpose_name: 'Sales Return', description: 'Retur penjualan', applied_to: 'SALES', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'SAL-REC', purpose_name: 'Sales Receipt', description: 'Penerimaan pembayaran dari customer', applied_to: 'SALES', is_system: true, is_active: true },
  
  // Inventory Related
  { company_id: COMPANY_ID, purpose_code: 'INV-ADJ', purpose_name: 'Inventory Adjustment', description: 'Penyesuaian stok persediaan', applied_to: 'INVENTORY', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'INV-TRF', purpose_name: 'Inventory Transfer', description: 'Transfer antar gudang', applied_to: 'INVENTORY', is_system: true, is_active: true },
  
  // Expense Related
  { company_id: COMPANY_ID, purpose_code: 'EXP-SAL', purpose_name: 'Salary Expense', description: 'Pembayaran gaji karyawan', applied_to: 'EXPENSE', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'EXP-UTL', purpose_name: 'Utility Expense', description: 'Beban listrik, air, gas', applied_to: 'EXPENSE', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'EXP-RNT', purpose_name: 'Rent Expense', description: 'Beban sewa tempat', applied_to: 'EXPENSE', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'EXP-OTH', purpose_name: 'Other Expense', description: 'Beban operasional lainnya', applied_to: 'EXPENSE', is_system: false, is_active: true },
  
  // Cash & Bank Related
  { company_id: COMPANY_ID, purpose_code: 'CSH-IN', purpose_name: 'Cash In', description: 'Penerimaan kas', applied_to: 'CASH', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'CSH-OUT', purpose_name: 'Cash Out', description: 'Pengeluaran kas', applied_to: 'CASH', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'BNK-TRF', purpose_name: 'Bank Transfer', description: 'Transfer antar bank', applied_to: 'BANK', is_system: true, is_active: true },
  
  // Asset Related
  { company_id: COMPANY_ID, purpose_code: 'AST-PUR', purpose_name: 'Asset Purchase', description: 'Pembelian aset tetap', applied_to: 'ASSET', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'AST-DEP', purpose_name: 'Asset Depreciation', description: 'Penyusutan aset tetap', applied_to: 'ASSET', is_system: true, is_active: true },
  
  // Tax Related
  { company_id: COMPANY_ID, purpose_code: 'TAX-PPN', purpose_name: 'VAT Transaction', description: 'Transaksi PPN', applied_to: 'TAX', is_system: true, is_active: true },
  { company_id: COMPANY_ID, purpose_code: 'TAX-PPH', purpose_name: 'Income Tax', description: 'Pajak penghasilan', applied_to: 'TAX', is_system: true, is_active: true }
]

export async function seedAccountingPurposes() {
  try {
    console.log('🌱 Seeding accounting purposes...')
    
    // Clear existing data
    await pool.query(
      `DELETE FROM accounting_purposes WHERE company_id = $1`,
      [COMPANY_ID]
    )
    
    // Insert seed data
    for (const purpose of accountingPurposesData) {
      await pool.query(
        `INSERT INTO accounting_purposes (company_id, purpose_code, purpose_name, description, applied_to, is_system, is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [purpose.company_id, purpose.purpose_code, purpose.purpose_name, purpose.description, purpose.applied_to, purpose.is_system, purpose.is_active, CREATED_BY, CREATED_BY]
      )
    }
    
    console.log(`✅ Seeded ${accountingPurposesData.length} accounting purposes`)
  } catch (error) {
    console.error('❌ Error seeding accounting purposes:', error)
    throw error
  }
}