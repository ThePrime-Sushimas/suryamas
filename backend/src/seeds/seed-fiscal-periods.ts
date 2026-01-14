import { supabase } from '../config/supabase'

const COMPANY_ID = '3576839e-d83a-4061-8551-fe9b5d971111'

const fiscalPeriods2025 = [
  { period: '2025-01', period_start: '2025-01-01', period_end: '2025-01-31', is_year_end: false },
  { period: '2025-02', period_start: '2025-02-01', period_end: '2025-02-28', is_year_end: false },
  { period: '2025-03', period_start: '2025-03-01', period_end: '2025-03-31', is_year_end: false },
  { period: '2025-04', period_start: '2025-04-01', period_end: '2025-04-30', is_year_end: false },
  { period: '2025-05', period_start: '2025-05-01', period_end: '2025-05-31', is_year_end: false },
  { period: '2025-06', period_start: '2025-06-01', period_end: '2025-06-30', is_year_end: false },
  { period: '2025-07', period_start: '2025-07-01', period_end: '2025-07-31', is_year_end: false },
  { period: '2025-08', period_start: '2025-08-01', period_end: '2025-08-31', is_year_end: false },
  { period: '2025-09', period_start: '2025-09-01', period_end: '2025-09-30', is_year_end: false },
  { period: '2025-10', period_start: '2025-10-01', period_end: '2025-10-31', is_year_end: false },
  { period: '2025-11', period_start: '2025-11-01', period_end: '2025-11-30', is_year_end: false },
  { period: '2025-12', period_start: '2025-12-01', period_end: '2025-12-31', is_year_end: true }
]

async function seedFiscalPeriods() {
  console.log('🌱 Seeding fiscal periods for 2025...')

  for (const fp of fiscalPeriods2025) {
    const { data, error } = await supabase
      .from('fiscal_periods')
      .insert({
        company_id: COMPANY_ID,
        fiscal_year: 2025,
        period: fp.period,
        period_start: fp.period_start,
        period_end: fp.period_end,
        is_year_end: fp.is_year_end,
        is_open: true,
        is_adjustment_allowed: true
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        console.log(`⏭️  ${fp.period} already exists, skipping...`)
      } else {
        console.error(`❌ Error seeding ${fp.period}:`, error.message)
      }
    } else {
      console.log(`✅ Created ${fp.period} (${fp.period_start} to ${fp.period_end})`)
    }
  }

  console.log('✨ Seeding complete!')
}

seedFiscalPeriods()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  })
