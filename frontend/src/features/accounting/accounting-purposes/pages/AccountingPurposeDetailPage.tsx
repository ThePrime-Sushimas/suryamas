import { useEffect } from 'react'
import { ArrowLeft, Edit, Trash2, RotateCcw, Calendar, User } from 'lucide-react'
import { useAccountingPurposesStore } from '../store/accountingPurposes.store'
import { AppliedToBadge } from '../components/AppliedToBadge'
import { SystemLockBadge } from '../components/SystemLockBadge'

interface AccountingPurposeDetailPageProps {
  purposeId: string
  onBack: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onRestore?: (id: string) => void
}

export const AccountingPurposeDetailPage = ({
  purposeId,
  onBack,
  onEdit,
  onDelete,
  onRestore
}: AccountingPurposeDetailPageProps) => {
  const { selectedPurpose, loading, error, fetchPurposeById } = useAccountingPurposesStore()
  
  // Use selectedPurpose directly or fetch if needed
  const purpose = selectedPurpose?.id === purposeId ? selectedPurpose : null

  useEffect(() => {
    if (!selectedPurpose || selectedPurpose.id !== purposeId) {
      fetchPurposeById(purposeId)
    }
  }, [purposeId, selectedPurpose, fetchPurposeById])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-800 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-700 dark:hover:bg-red-800"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!purpose) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Accounting purpose not found</p>
          <button
            onClick={onBack}
            className="bg-gray-600 dark:bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const canModify = !purpose.is_system

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{purpose.purpose_name}</h1>
            <p className="text-gray-600 dark:text-gray-400 font-mono">{purpose.purpose_code}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          {purpose.is_deleted && onRestore ? (
            <button
              onClick={() => onRestore(purpose.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700"
            >
              <RotateCcw size={16} />
              Restore
            </button>
          ) : (
            <>
              <button
                onClick={() => onEdit(purpose.id)}
                disabled={!canModify}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  canModify
                    ? 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
                title={!canModify ? 'System purposes cannot be edited' : ''}
              >
                <Edit size={16} />
                Edit
              </button>
              
              <button
                onClick={() => onDelete(purpose.id)}
                disabled={!canModify}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  canModify
                    ? 'bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
                title={!canModify ? 'System purposes cannot be deleted' : ''}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Purpose Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Purpose Code
                </label>
                <p className="text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border border-gray-200 dark:border-gray-600">
                  {purpose.purpose_code}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Purpose Name
                </label>
                <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border border-gray-200 dark:border-gray-600">
                  {purpose.purpose_name}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Applied To
                </label>
                <div className="mt-1">
                  <AppliedToBadge appliedTo={purpose.applied_to} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    purpose.is_active 
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {purpose.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {purpose.is_deleted && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      Deleted
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {purpose.description && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border border-gray-200 dark:border-gray-600">
                  {purpose.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Type Badge */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Type</h3>
            <SystemLockBadge isSystem={purpose.is_system} />
            {!purpose.is_system && (
              <span className="text-sm text-gray-500 dark:text-gray-400 mt-2 block">Custom Purpose</span>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Information</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Created</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(purpose.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Last Updated</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(purpose.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              
              {purpose.created_by && (
                <div className="flex items-center gap-3 text-sm">
                  <User size={16} className="text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Created By</p>
                    <p className="text-gray-900 dark:text-white">{purpose.created_by}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
