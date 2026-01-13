import { useEffect } from 'react'
import { ArrowLeft, Edit, Trash2, Calendar, User } from 'lucide-react'
import { useAccountingPurposesStore } from '../store/accountingPurposes.store'
import { AppliedToBadge } from '../components/AppliedToBadge'
import { SystemLockBadge } from '../components/SystemLockBadge'

interface AccountingPurposeDetailPageProps {
  purposeId: string
  onBack: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const AccountingPurposeDetailPage = ({
  purposeId,
  onBack,
  onEdit,
  onDelete
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
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
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
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600 mb-4">Accounting purpose not found</p>
          <button
            onClick={onBack}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
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
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{purpose.purpose_name}</h1>
            <p className="text-gray-600 font-mono">{purpose.purpose_code}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => onEdit(purpose.id)}
            disabled={!canModify}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              canModify
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title={!canModify ? 'System purposes cannot be deleted' : ''}
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Purpose Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose Code
                </label>
                <p className="text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border">
                  {purpose.purpose_code}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose Name
                </label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                  {purpose.purpose_name}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applied To
                </label>
                <div className="mt-1">
                  <AppliedToBadge appliedTo={purpose.applied_to} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    purpose.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {purpose.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            
            {purpose.description && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                  {purpose.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Type Badge */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Type</h3>
            <SystemLockBadge isSystem={purpose.is_system} />
            {!purpose.is_system && (
              <span className="text-sm text-gray-500 mt-2 block">Custom Purpose</span>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Information</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={16} className="text-gray-400" />
                <div>
                  <p className="text-gray-600">Created</p>
                  <p className="text-gray-900">
                    {new Date(purpose.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={16} className="text-gray-400" />
                <div>
                  <p className="text-gray-600">Last Updated</p>
                  <p className="text-gray-900">
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
                  <User size={16} className="text-gray-400" />
                  <div>
                    <p className="text-gray-600">Created By</p>
                    <p className="text-gray-900">{purpose.created_by}</p>
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