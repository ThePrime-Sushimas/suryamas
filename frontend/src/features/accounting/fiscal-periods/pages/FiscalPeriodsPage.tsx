import { Routes, Route } from 'react-router-dom'
import { FiscalPeriodsListPage } from './FiscalPeriodsListPage'
import { FiscalPeriodFormPage } from './FiscalPeriodFormPage'
import { FiscalPeriodEditPage } from './FiscalPeriodEditPage'
import { FiscalPeriodsDeletedPage } from './FiscalPeriodsDeletedPage'

export function FiscalPeriodsPage() {
  return (
    <Routes>
      <Route index element={<FiscalPeriodsListPage />} />
      <Route path="new" element={<FiscalPeriodFormPage />} />
      <Route path=":id/edit" element={<FiscalPeriodEditPage />} />
      <Route path="deleted" element={<FiscalPeriodsDeletedPage />} />
    </Routes>
  )
}
