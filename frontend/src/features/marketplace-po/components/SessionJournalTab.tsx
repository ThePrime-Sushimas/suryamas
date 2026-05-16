import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { journalHeadersApi } from '@/features/accounting/journals/journal-headers/api/journalHeaders.api'
import type {
  JournalLine,
  JournalLineWithDetails,
} from '@/features/accounting/journals/shared/journal.types'
import { fmtCurrency } from '../utils/format'
import type { MarketplaceCheckoutSession } from '../types/marketplacePo.types'

function isLineWithDetails(l: JournalLine | JournalLineWithDetails): l is JournalLineWithDetails {
  return 'account_code' in l && !!l.account_code
}

type JournalBlock = {
  label: string
  journalId: string | null
  placeholder?: string
}

function JournalBlockView({ block }: { block: JournalBlock }) {
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState<
    Array<{ account_code?: string; account_name?: string; debit_amount: number; credit_amount: number }>
  >([])
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!block.journalId) return
    setLoading(true)
    journalHeadersApi
      .getById(block.journalId)
      .then((j) => {
        setDescription(j.description ?? '')
        setLines(
          (j.lines ?? []).map((l) => ({
            account_code: isLineWithDetails(l) ? l.account_code : l.account_id,
            account_name: isLineWithDetails(l) ? l.account_name : '',
            debit_amount: Number(l.debit_amount),
            credit_amount: Number(l.credit_amount),
          })),
        )
      })
      .catch(() => setLines([]))
      .finally(() => setLoading(false))
  }, [block.journalId])

  if (!block.journalId) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1">[{block.label}]</p>
        <p className="text-sm text-gray-400">{block.placeholder ?? 'Journal belum di-post'}</p>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <p className="text-xs font-semibold text-teal-600 uppercase mb-2">[{block.label}]</p>
      {loading ? (
        <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{description}</p>
          <div className="space-y-1 text-sm font-mono">
            {lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-4 text-gray-600 dark:text-gray-400">
                <span className="truncate">
                  {Number(l.debit_amount) > 0 ? 'Dr' : 'Cr'} {l.account_code} {l.account_name}
                </span>
                <span className="shrink-0">
                  {fmtCurrency(Number(l.debit_amount) > 0 ? l.debit_amount : l.credit_amount)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function SessionJournalTab({ header }: { header: MarketplaceCheckoutSession }) {
  const blocks: JournalBlock[] = [
    {
      label: 'ORDERED',
      journalId: header.journal_ordered_id,
      placeholder: 'Journal checkout akan muncul setelah status Dipesan',
    },
    {
      label: 'RECEIVED',
      journalId: header.journal_received_id,
      placeholder: 'Journal penerimaan barang akan muncul setelah status Diterima',
    },
    {
      label: 'SETTLED',
      journalId: header.journal_settled_id,
      placeholder: 'Journal pelunasan akan muncul setelah status Lunas',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        <BookOpen className="w-4 h-4" />
        <p className="text-xs">Jurnal di-post otomatis oleh sistem (read-only)</p>
      </div>
      {blocks.map((b) => (
        <JournalBlockView key={b.label} block={b} />
      ))}
    </div>
  )
}
