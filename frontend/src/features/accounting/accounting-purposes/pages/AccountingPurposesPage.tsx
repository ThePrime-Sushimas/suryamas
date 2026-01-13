import { useState } from 'react'
import { useBranchContext } from '@/features/branch_context'
import { AccountingPurposesListPage } from './AccountingPurposesListPage'
import { AccountingPurposeFormPage } from './AccountingPurposeFormPage'
import { AccountingPurposeDetailPage } from './AccountingPurposeDetailPage'
import { useAccountingPurposesStore } from '../store/accountingPurposes.store'
import type { AccountingPurpose } from '../types/accounting-purpose.types'

type PageView = 'list' | 'create' | 'edit' | 'detail'

interface AccountingPurposesPageProps {
  companyId: string
  branchId?: string
}

export const AccountingPurposesPage = () => {
  const currentBranch = useBranchContext()
  
  if (!currentBranch?.company_id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Company Selected</h2>
          <p className="text-gray-600">Please select a branch to continue.</p>
        </div>
      </div>
    )
  }
  
  const [currentView, setCurrentView] = useState<PageView>('list')
  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(null)
  const [selectedPurpose, setSelectedPurpose] = useState<AccountingPurpose | null>(null)
  const { deletePurpose, fetchPurposeById } = useAccountingPurposesStore()

  const handleCreateNew = () => {
    setSelectedPurposeId(null)
    setSelectedPurpose(null)
    setCurrentView('create')
  }

  const handleView = (id: string) => {
    setSelectedPurposeId(id)
    setCurrentView('detail')
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

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this accounting purpose?')) {
      try {
        await deletePurpose(id)
        setCurrentView('list')
      } catch (error) {
        console.error('Failed to delete purpose:', error)
      }
    }
  }

  const handleBack = () => {
    setCurrentView('list')
    setSelectedPurposeId(null)
    setSelectedPurpose(null)
  }

  const handleSuccess = () => {
    setCurrentView('list')
    setSelectedPurposeId(null)
    setSelectedPurpose(null)
  }

  switch (currentView) {
    case 'create':
      return (
        <AccountingPurposeFormPage
          isEdit={false}
          onBack={handleBack}
          onSuccess={handleSuccess}
        />
      )

    case 'edit':
      return (
        <AccountingPurposeFormPage
          purposeId={selectedPurposeId!}
          initialData={selectedPurpose!}
          isEdit={true}
          onBack={handleBack}
          onSuccess={handleSuccess}
        />
      )

    case 'detail':
      return (
        <AccountingPurposeDetailPage
          purposeId={selectedPurposeId!}
          onBack={handleBack}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )

    default:
      return (
        <AccountingPurposesListPage
          onCreateNew={handleCreateNew}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )
  }
}