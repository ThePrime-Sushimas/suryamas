import { Routes, Route } from 'react-router-dom'
import { AccountingPurposeAccountsListPage } from './AccountingPurposeAccountsListPage'
import { AccountingPurposeAccountFormPage } from './AccountingPurposeAccountFormPage'

export const AccountingPurposeAccountsPage = () => {
  return (
    <Routes>
      <Route index element={<AccountingPurposeAccountsListPage />} />
      <Route path="create" element={<AccountingPurposeAccountFormPage />} />
      <Route path=":id/edit" element={<AccountingPurposeAccountFormPage />} />
    </Routes>
  )
}