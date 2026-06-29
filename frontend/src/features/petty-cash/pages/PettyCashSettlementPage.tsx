import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
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
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="h-4 w-4" />}
        onClick={() => navigate(`/finance/petty-cash/${id}`)}
        className="-ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
      >
        Kembali ke Detail
      </Button>

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
        <Button
          variant="secondary"
          onClick={() => navigate(`/finance/petty-cash/${id}`)}
          disabled={isPending}
        >
          Batal
        </Button>
        <Button variant="primary" loading={isPending} onClick={handleSubmit}>
          Post Settlement
        </Button>
      </div>
    </div>
  )
}
