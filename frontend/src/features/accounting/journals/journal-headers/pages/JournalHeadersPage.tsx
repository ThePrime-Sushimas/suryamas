import { Routes, Route } from 'react-router-dom'
import { JournalHeadersListPage } from './JournalHeadersListPage'
import { JournalHeaderFormPage } from './JournalHeaderFormPage'
import { JournalHeaderEditPage } from './JournalHeaderEditPage'
import { JournalHeaderDetailPage } from './JournalHeaderDetailPage'

export default function JournalHeadersPage() {
  return (
    <Routes>
      <Route index element={<JournalHeadersListPage />} />
      <Route path="new" element={<JournalHeaderFormPage />} />
      <Route path=":id" element={<JournalHeaderDetailPage />} />
      <Route path=":id/edit" element={<JournalHeaderEditPage />} />
    </Routes>
  )
}
