import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useCompaniesStore } from '../store/companies.store'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { BankAccountsSection } from '@/features/bank-accounts'

function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedCompany, loading, getCompanyById, deleteCompany, reset } = useCompaniesStore()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'overview' | 'bank-accounts'>('overview')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (id) {
      getCompanyById(id).catch(() => {
        toast.error('Perusahaan tidak ditemukan')
        navigate('/companies')
      })
    }
    return () => reset()
  }, [id, getCompanyById, navigate, reset, toast])

  const handleConfirmDelete = async () => {
    if (!id) return
    setIsDeleting(true)
    try {
      await deleteCompany(id)
      toast.success('Perusahaan berhasil dihapus')
      navigate('/companies')
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="p-6 animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/3" />
              <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-2" />
                    <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedCompany) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Perusahaan tidak ditemukan</p>
          <button onClick={() => navigate('/companies')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Kembali ke Daftar
          </button>
        </div>
      </div>
    )
  }

  const tabCls = (active: boolean) =>
    `py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
      active ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/companies')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCompany.company_name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCompany.company_code} · {selectedCompany.company_type}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(`/companies/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              <Pencil className="w-4 h-4" /> Edit
            </button>
            <button onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
              <Trash2 className="w-4 h-4" /> Hapus
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6">
            <div className="flex gap-4">
              <button onClick={() => setActiveTab('overview')} className={tabCls(activeTab === 'overview')}>Ringkasan</button>
              <button onClick={() => setActiveTab('bank-accounts')} className={tabCls(activeTab === 'bank-accounts')}>Rekening Bank</button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InfoItem label="Kode Perusahaan" value={selectedCompany.company_code} />
                <InfoItem label="Tipe Perusahaan" value={selectedCompany.company_type} />
                <InfoItem label="Status" value={<StatusBadge status={selectedCompany.status} />} />
                <InfoItem label="NPWP" value={selectedCompany.npwp || '-'} />
                <InfoItem label="Email" value={selectedCompany.email || '-'} />
                <InfoItem label="Telepon" value={selectedCompany.phone || '-'} />
                <InfoItem label="Website" value={selectedCompany.website || '-'} className="sm:col-span-2" />
              </div>
            )}

            {activeTab === 'bank-accounts' && selectedCompany.id && (
              <BankAccountsSection ownerType="company" ownerId={selectedCompany.id} companyId={selectedCompany.id} />
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Hapus Perusahaan"
        message={`Yakin ingin menghapus "${selectedCompany.company_name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={isDeleting ? 'Menghapus...' : 'Hapus'}
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
      />
    </div>
  )
}

function InfoItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    suspended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || styles.inactive}`}>
      {status}
    </span>
  )
}

export default CompanyDetailPage
