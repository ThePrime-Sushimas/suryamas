import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { BankTable } from '../components/BankTable'

export const BanksListPage = () => {
  const navigate = useNavigate()

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Bank</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Kelola data master bank</p>
        </div>
        <button
          onClick={() => navigate('/settings/banks/create')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
        >
          <Plus className="h-4 w-4" />
          Tambah Bank
        </button>
      </div>
      <BankTable />
    </div>
  )
}
