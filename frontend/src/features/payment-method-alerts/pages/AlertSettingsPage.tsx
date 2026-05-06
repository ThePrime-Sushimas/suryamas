import { useState } from 'react'
import { Bell, Plus, History } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { AlertCard } from '../components/AlertCard'
import { AlertForm } from '../components/AlertForm'
import { useAlerts, useCreateAlert, useUpdateAlert, useDeleteAlert, useTestAlert } from '../api/alerts'
import type { PaymentMethodAlert } from '../types'

export default function AlertSettingsPage() {
  const { data: alerts = [], isLoading } = useAlerts()
  const [showForm, setShowForm] = useState(false)
  const [editingAlert, setEditingAlert] = useState<PaymentMethodAlert | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  
  const createMutation = useCreateAlert()
  const updateMutation = useUpdateAlert()
  const deleteMutation = useDeleteAlert()
  const testMutation = useTestAlert()



  const openCreate = () => {
    setEditingAlert(null)
    setShowForm(true)
  }

  const openEdit = (alert: PaymentMethodAlert) => {
    setEditingAlert(alert)
    setShowForm(true)
  }

  const handleSubmit = (data: any) => {
    if (editingAlert) {
      updateMutation.mutate({ id: editingAlert.id, dto: data }, {
        onSuccess: () => setShowForm(false)
      })
    } else {
      createMutation.mutate(data, {
        onSuccess: () => setShowForm(false)
      })
    }
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => setDeleteTarget(null)
    })
  }

  const handleTest = (id: string) => {
    testMutation.mutate(id)
  }

  const handleToggle = (alert: PaymentMethodAlert) => {
    updateMutation.mutate({ id: alert.id, dto: { is_active: !alert.is_active } })
  }



  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-amber-500" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Alert Threshold</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Notifikasi Telegram saat payment method mencapai threshold</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/settings/alerts/history"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
            >
              <History className="w-3.5 h-3.5" /> History
            </Link>
            <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0 p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />)}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada alert. Tambahkan untuk mulai monitoring.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onTest={handleTest}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AlertForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        editingAlert={editingAlert}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Alert"
        message="Hapus alert ini? Notifikasi tidak akan dikirim lagi."
        confirmText="Hapus"
        variant="danger"
      />
    </div>
  )
}
