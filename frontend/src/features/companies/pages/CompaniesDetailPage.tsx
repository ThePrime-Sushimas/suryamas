import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCompaniesStore } from '../store/companies.store'
import { useToast } from '@/contexts/ToastContext'
import { BankAccountsSection } from '@/features/bank-accounts'

function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedCompany, loading, getCompanyById, deleteCompany, reset } = useCompaniesStore()
  const { success, error } = useToast()
  const [activeTab, setActiveTab] = useState<'overview' | 'bank-accounts'>('overview')

  useEffect(() => {
    if (id) {
      getCompanyById(id).catch(() => {
        error('Company not found')
        navigate('/companies')
      })
    }
    return () => reset()
  }, [id, getCompanyById, navigate, reset, error])

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this company?')) return
    
    try {
      await deleteCompany(id)
      success('Company deleted successfully')
      navigate('/companies')
    } catch {
      error('Failed to delete company')
    }
  }

  if (loading) return <div className="p-6 text-center dark:text-gray-300">Loading...</div>
  if (!selectedCompany) return <div className="p-6 text-center text-red-600 dark:text-red-400">Company not found</div>

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCompany.company_name}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/companies/${id}/edit`)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b dark:border-gray-700">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('bank-accounts')}
              className={`py-3 px-4 border-b-2 font-medium transition-colors ${
                activeTab === 'bank-accounts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Bank Accounts
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Company Code</label>
                  <p className="text-lg text-gray-900 dark:text-white">{selectedCompany.company_code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Company Type</label>
                  <p className="text-lg text-gray-900 dark:text-white">{selectedCompany.company_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
                  <p className="text-lg capitalize text-gray-900 dark:text-white">{selectedCompany.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">NPWP</label>
                  <p className="text-lg text-gray-900 dark:text-white">{selectedCompany.npwp || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</label>
                  <p className="text-lg text-gray-900 dark:text-white">{selectedCompany.email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</label>
                  <p className="text-lg text-gray-900 dark:text-white">{selectedCompany.phone || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Website</label>
                  <p className="text-lg text-gray-900 dark:text-white">{selectedCompany.website || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bank-accounts' && selectedCompany.id && (
            <BankAccountsSection ownerType="company" ownerId={selectedCompany.id} />
          )}
        </div>
      </div>

      <button
        onClick={() => navigate('/companies')}
        className="mt-6 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600"
      >
        Back to List
      </button>
    </div>
  )
}

export default CompanyDetailPage
