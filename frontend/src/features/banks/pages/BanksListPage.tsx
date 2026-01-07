import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { BankTable } from '../components/BankTable'

export const BanksListPage = () => {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banks</h1>
          <p className="text-gray-600 mt-1">Manage master bank data</p>
        </div>
        <button
          onClick={() => navigate('/settings/banks/create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-5 w-5" />
          Add Bank
        </button>
      </div>

      <BankTable />
    </div>
  )
}
