import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Pencil } from 'lucide-react'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { usePaymentTerm } from '../api/paymentTerms.api'
import { PaymentTermStatusBadge } from '../components/PaymentTermStatusBadge'

const CALC_TYPE_LABELS: Record<string, string> = {
  from_invoice: 'Dari Invoice',
  from_delivery: 'Dari Pengiriman',
  fixed_date: 'Tanggal Tetap',
  fixed_date_immediate: 'Tanggal Tetap (Segera)',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  monthly_immediate: 'Bulanan (slot hari ini)',
}

const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function PaymentTermDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const numId = parseInt(id || '0')
  const term = usePaymentTerm(numId)

  if (term.isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="space-y-4">
          <div className="flex items-center gap-3"><div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"><FormSkeleton /></div>
        </div>
      </div>
    )
  }

  if (!term.data) {
    return (
      <div className="max-w-3xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Syarat pembayaran tidak ditemukan</h3>
          <button onClick={() => navigate('/payment-terms')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  const t = term.data

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/payment-terms')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <FileText className="w-6 h-6 text-blue-600" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t.term_name}</h1>
          <p className="text-xs text-gray-400">{t.term_code}</p>
        </div>
        <button onClick={() => navigate(`/payment-terms/${t.id}/edit`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Status</p>
          <div className="mt-1"><PaymentTermStatusBadge isActive={t.is_active} isDeleted={!!t.deleted_at} /></div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Tipe Kalkulasi</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{CALC_TYPE_LABELS[t.calculation_type] || t.calculation_type}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Jatuh Tempo</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{t.days} hari</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Grace Period</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{t.grace_period_days} hari</p>
        </div>
      </div>

      {/* Detail Sections */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {/* Diskon & Penalti */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Diskon & Penalti</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">Diskon Pembayaran Awal</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t.early_payment_discount > 0 ? `${t.early_payment_discount}% (dalam ${t.early_payment_days} hari)` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Penalti Keterlambatan</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t.late_payment_penalty > 0 ? `${t.late_payment_penalty}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Grace Period</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t.grace_period_days} hari</p>
            </div>
          </div>
        </div>

        {/* Order Limits */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Batas Order</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Minimum Order</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t.minimum_order_amount > 0 ? fmtCurrency(t.minimum_order_amount) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Maximum Order</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t.maximum_order_amount ? fmtCurrency(t.maximum_order_amount) : 'Tidak terbatas'}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Schedule */}
        {(t.payment_dates || t.payment_day_of_week !== null) && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Jadwal Pembayaran</h3>
            {t.payment_dates && t.payment_dates.length > 0 && (
              <div>
                <p className="text-xs text-gray-400">Tanggal Pembayaran</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t.payment_dates.map(d => `Tgl ${d}`).join(', ')}
                </p>
              </div>
            )}
            {t.payment_day_of_week !== null && (
              <div className="mt-2">
                <p className="text-xs text-gray-400">Hari Pembayaran</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][t.payment_day_of_week] || `Hari ke-${t.payment_day_of_week}`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Allowed Methods */}
        {t.allowed_payment_methods && t.allowed_payment_methods.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Metode Pembayaran Diizinkan</h3>
            <div className="flex flex-wrap gap-2">
              {t.allowed_payment_methods.map(m => (
                <span key={m} className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {t.description && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Deskripsi</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t.description}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-6 text-xs text-gray-400">
            <span>Dibuat: {new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span>Diperbarui: {new Date(t.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {t.deleted_at && <span className="text-red-500">Dihapus: {new Date(t.deleted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
