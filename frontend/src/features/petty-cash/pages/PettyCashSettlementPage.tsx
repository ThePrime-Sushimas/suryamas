import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useCompanyBankAccounts } from '@/features/ap-payments/hooks/useCompanyBankAccounts'
import { usePettyCashRequest } from '../hooks/pettyCash.api'
import { useSettlementForm } from '../hooks/useSettlementForm'
import { SettlementSummaryCard } from '../components/SettlementSummaryCard'
import { SettlementForm } from '../components/SettlementForm'
import { SettlementPreviewCard } from '../components/SettlementPreviewCard'

export default function PettyCashSettlementPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: request, isLoading } = usePettyCashRequest(id ?? '')
  const { data: bankAccounts = [] } = useCompanyBankAccounts()
  const {
    form,
    setForm,
    remaining,
    amountReturned,
    refillAmount,
    carriedToAmount,
    totalDanaBaru,
    handleSubmit,
    isPending,
  } = useSettlementForm(id ?? '', request)

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  if (!request)
    return (
      <div className="text-center py-12 text-gray-500">
        Request tidak ditemukan
      </div>
    )
  if (request.status !== 'DISBURSED')
    return (
      <div className="text-center py-12 text-gray-500">
        Request harus berstatus Aktif untuk settlement
      </div>
    )

  const expenses = request.expenses ?? []

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate(`/finance/petty-cash/${id}`)}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Detail
      </button>

      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        Settlement Kas Kecil
      </h1>

      <SettlementSummaryCard
        request={request}
        remaining={remaining}
        expenses={expenses}
      />

      <SettlementForm
        form={form}
        setForm={setForm}
        amountReturned={amountReturned}
        refillAmount={refillAmount}
        bankAccounts={bankAccounts}
      />

      <SettlementPreviewCard
        remaining={remaining}
        amountReturned={amountReturned}
        carriedToAmount={carriedToAmount}
        refillAmount={refillAmount}
        totalDanaBaru={totalDanaBaru}
      />

      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate(`/finance/petty-cash/${id}`)}
          className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Post Settlement'
          )}
        </button>
      </div>
    </div>
  )
}
