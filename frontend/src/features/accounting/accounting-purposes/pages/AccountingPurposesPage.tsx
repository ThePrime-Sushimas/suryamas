import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBranchContext } from '@/features/branch_context'
import { AccountingPurposesListPage } from './AccountingPurposesListPage'
import { AccountingPurposeFormPage } from './AccountingPurposeFormPage'
import { AccountingPurposeDetailPage } from './AccountingPurposeDetailPage'
import { useAccountingPurposesStore } from '../store/accountingPurposes.store'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { AccountingPurpose } from '../types/accounting-purpose.types'

type PageView = 'list' | 'create' | 'edit' | 'detail'

export const AccountingPurposesPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const currentBranch = useBranchContext()
  const [currentView, setCurrentView] = useState<PageView>('list')
  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(null)
  const [selectedPurpose, setSelectedPurpose] = useState<AccountingPurpose | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [restoreConfirm, setRestoreConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const { deletePurpose, restorePurpose, fetchPurposeById } = useAccountingPurposesStore()
  
  // Handle URL parameter for direct access to detail page
  useEffect(() => {
    if (id) {
      setSelectedPurposeId(id)
      setCurrentView('detail')
    }
  }, [id])

  if (!currentBranch?.company_id) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Company Selected</h2>
            <p className="text-gray-600 dark:text-gray-400">Please select a branch to continue.</p>
          </div>
        </div>
      </div>
    )
  }

  const handleCreateNew = () => {
    setSelectedPurposeId(null)
    setSelectedPurpose(null)
    setCurrentView('create')
  }

  const handleView = (id: string) => {
    setSelectedPurposeId(id)
    navigate(`/accounting-purposes/${id}`)
  }

  const handleEdit = async (id: string) => {
    try {
      const purpose = await fetchPurposeById(id)
      setSelectedPurposeId(id)
      setSelectedPurpose(purpose)
      setCurrentView('edit')
    } catch (error) {
      console.error('Failed to fetch purpose for editing:', error)
    }
  }

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ open: true, id })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return
    try {
      await deletePurpose(deleteConfirm.id)
      setDeleteConfirm({ open: false, id: null })
      setCurrentView('list')
    } catch (error) {
      console.error('Failed to delete purpose:', error)
    }
  }

  const handleRestoreClick = (id: string) => {
    setRestoreConfirm({ open: true, id })
  }

  const handleRestoreConfirm = async () => {
    if (!restoreConfirm.id) return
    try {
      await restorePurpose(restoreConfirm.id)
      setRestoreConfirm({ open: false, id: null })
      setCurrentView('list')
    } catch (error) {
      console.error('Failed to restore purpose:', error)
    }
  }

  const handleBack = () => {
    setCurrentView('list')
    setSelectedPurposeId(null)
    setSelectedPurpose(null)
    navigate('/accounting-purposes')
  }

  const handleSuccess = () => {
    setCurrentView('list')
    setSelectedPurposeId(null)
    setSelectedPurpose(null)
    navigate('/accounting-purposes')
  }

  switch (currentView) {
    case 'create':
    case 'edit':
    case 'detail':
      return (
        <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
          <div className="flex-1 overflow-auto p-6">
            {currentView === 'create' && (
              <AccountingPurposeFormPage
                isEdit={false}
                onBack={handleBack}
                onSuccess={handleSuccess}
              />
            )}
            {currentView === 'edit' && (
              <AccountingPurposeFormPage
                purposeId={selectedPurposeId!}
                initialData={selectedPurpose!}
                isEdit={true}
                onBack={handleBack}
                onSuccess={handleSuccess}
              />
            )}
            {currentView === 'detail' && (
              <AccountingPurposeDetailPage
                purposeId={selectedPurposeId!}
                onBack={handleBack}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onRestore={handleRestoreClick}
              />
            )}
          </div>
        </div>
      )

    default:
      return (
        <>
          <AccountingPurposesListPage
            onCreateNew={handleCreateNew}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onRestore={handleRestoreClick}
          />
          
          {/* Delete Confirmation Modal */}
          <ConfirmModal
            isOpen={deleteConfirm.open}
            onClose={() => setDeleteConfirm({ open: false, id: null })}
            onConfirm={handleDeleteConfirm}
            title="Confirm Delete"
            message="Are you sure you want to delete this accounting purpose?"
            confirmText="Delete"
            variant="danger"
          />

          {/* Restore Confirmation Modal */}
          <ConfirmModal
            isOpen={restoreConfirm.open}
            onClose={() => setRestoreConfirm({ open: false, id: null })}
            onConfirm={handleRestoreConfirm}
            title="Confirm Restore"
            message="Are you sure you want to restore this accounting purpose?"
            confirmText="Restore"
            variant="success"
          />
        </>
      )
  }
}
