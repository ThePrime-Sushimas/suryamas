import { useState } from 'react'
import { Bell, Plus, History, Layers } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { AlertCard } from '../components/AlertCard'
import { AlertForm } from '../components/AlertForm'
import { AlertGroupCard } from '../components/AlertGroupCard'
import { AlertGroupForm } from '../components/AlertGroupForm'
import { useAlerts, useCreateAlert, useUpdateAlert, useDeleteAlert, useTestAlert } from '../api/alerts'
import { useAlertGroups, useCreateAlertGroup, useUpdateAlertGroup, useDeleteAlertGroup, useTestAlertGroup } from '../api/alertGroups'
import type { PaymentMethodAlert, PaymentMethodAlertGroup, CreateAlertGroupDto, UpdateAlertGroupDto, CreateAlertDto, UpdateAlertDto } from '../types'

export default function AlertSettingsPage() {
  const { data: alerts = [], isLoading } = useAlerts()
  const { data: groups = [], isLoading: groupsLoading } = useAlertGroups()

  // Single alert state
  const [showForm, setShowForm] = useState(false)
  const [editingAlert, setEditingAlert] = useState<PaymentMethodAlert | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Group alert state
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<PaymentMethodAlertGroup | null>(null)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<string | null>(null)

  // Single alert mutations
  const createMutation = useCreateAlert()
  const updateMutation = useUpdateAlert()
  const deleteMutation = useDeleteAlert()
  const testMutation = useTestAlert()

  // Group alert mutations
  const createGroupMutation = useCreateAlertGroup()
  const updateGroupMutation = useUpdateAlertGroup()
  const deleteGroupMutation = useDeleteAlertGroup()
  const testGroupMutation = useTestAlertGroup()

  // --- Single Alert Handlers ---
  const openCreate = () => {
    setEditingAlert(null)
    setShowForm(true)
  }

  const openEdit = (alert: PaymentMethodAlert) => {
    setEditingAlert(alert)
    setShowForm(true)
  }

  const handleSubmit = (data: CreateAlertDto | UpdateAlertDto) => {
    if (editingAlert) {
      updateMutation.mutate({ id: editingAlert.id, dto: data }, {
        onSuccess: () => setShowForm(false)
      })
    } else {
      createMutation.mutate(data as CreateAlertDto, {
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

  // --- Group Alert Handlers ---
  const openCreateGroup = () => {
    setEditingGroup(null)
    setShowGroupForm(true)
  }

  const openEditGroup = (group: PaymentMethodAlertGroup) => {
    setEditingGroup(group)
    setShowGroupForm(true)
  }

  const handleGroupSubmit = (data: CreateAlertGroupDto | UpdateAlertGroupDto) => {
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, dto: data }, {
        onSuccess: () => setShowGroupForm(false)
      })
    } else {
      createGroupMutation.mutate(data as CreateAlertGroupDto, {
        onSuccess: () => setShowGroupForm(false)
      })
    }
  }

  const handleGroupDelete = () => {
    if (!deleteGroupTarget) return
    deleteGroupMutation.mutate(deleteGroupTarget, {
      onSuccess: () => setDeleteGroupTarget(null)
    })
  }

  const handleGroupTest = (id: string) => {
    testGroupMutation.mutate(id)
  }

  const handleGroupToggle = (group: PaymentMethodAlertGroup) => {
    updateGroupMutation.mutate({ id: group.id, dto: { is_active: !group.is_active } })
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
      <div className="flex-1 overflow-auto min-h-0 p-4 sm:p-6 space-y-6">
        {/* Single Alerts Section */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Per Payment Method
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-6">
              <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Belum ada alert single.</p>
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
        </section>

        {/* Group Alerts Section */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Gabungan Payment Method
            </h2>
            <button onClick={openCreateGroup} className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 text-white text-[11px] rounded-lg hover:bg-purple-700 font-medium">
              <Plus className="w-3 h-3" /> Group
            </button>
          </div>
          {groupsLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-6">
              <Layers className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Belum ada alert group. Gabungkan 2+ payment method dengan satu threshold.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(group => (
                <AlertGroupCard
                  key={group.id}
                  group={group}
                  onEdit={openEditGroup}
                  onDelete={setDeleteGroupTarget}
                  onTest={handleGroupTest}
                  onToggle={handleGroupToggle}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Single Alert Form Modal */}
      <AlertForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        editingAlert={editingAlert}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Group Alert Form Modal */}
      <AlertGroupForm
        isOpen={showGroupForm}
        onClose={() => setShowGroupForm(false)}
        onSubmit={handleGroupSubmit}
        editingGroup={editingGroup}
        loading={createGroupMutation.isPending || updateGroupMutation.isPending}
      />

      {/* Delete Single Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Alert"
        message="Hapus alert ini? Notifikasi tidak akan dikirim lagi."
        confirmText="Hapus"
        variant="danger"
      />

      {/* Delete Group Confirm */}
      <ConfirmModal
        isOpen={!!deleteGroupTarget}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={handleGroupDelete}
        title="Hapus Alert Group"
        message="Hapus alert group ini? Notifikasi gabungan tidak akan dikirim lagi."
        confirmText="Hapus"
        variant="danger"
      />
    </div>
  )
}
