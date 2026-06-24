import { Routes, Route } from 'react-router-dom'
import { FiscalPeriodsListPage } from './FiscalPeriodsListPage'
import { FiscalPeriodFormPage } from './FiscalPeriodFormPage'
import { FiscalPeriodEditPage } from './FiscalPeriodEditPage'
import { FiscalPeriodsDeletedPage } from './FiscalPeriodsDeletedPage'
import { FiscalPeriodSnapshotsPage } from './FiscalPeriodSnapshotsPage'

export function FiscalPeriodsPage() {
  return (
    <Routes>
      <Route index element={<FiscalPeriodsListPage />} />
      <Route path="new" element={<FiscalPeriodFormPage />} />
      <Route path=":id/edit" element={<FiscalPeriodEditPage />} />
      <Route path=":id/snapshots" element={<FiscalPeriodSnapshotsPage />} />
      <Route path="deleted" element={<FiscalPeriodsDeletedPage />} />
    </Routes>
  )
}
