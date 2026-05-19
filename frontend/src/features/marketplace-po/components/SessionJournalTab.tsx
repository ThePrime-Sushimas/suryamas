import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Send, ExternalLink } from 'lucide-react'
import { usePostReceiveJournal } from '../api/marketplacePo.api'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { MarketplaceCheckoutSession } from '../types/marketplacePo.types'

interface JournalBlock {
  label: string
  journalId: string | null
  placeholder: string
}

export function SessionJournalTab({ header }: { header: MarketplaceCheckoutSession }) {
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canRelease = hasPermission('marketplace_po', 'release')
  const postJournal = usePostReceiveJournal()
  const [posting, setPosting] = useState(false)

  const handlePostReceive = async () => {
    setPosting(true)
    try {
      await postJournal.mutateAsync({ id: header.id })
      toast.success('Journal receive berhasil di-post')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal post journal'))
    } finally {
      setPosting(false)
    }
  }

  const blocks: JournalBlock[] = [
    {
      label: 'ORDERED',
      journalId: header.journal_ordered_id,
      placeholder: 'Journal checkout akan muncul setelah status Dipesan',
    },
    {
      label: 'RECEIVED',
      journalId: header.journal_received_id,
      placeholder: 'Menunggu post journal oleh admin',
    },
    {
      label: 'SETTLED',
      journalId: header.journal_settled_id,
      placeholder: 'Journal pelunasan akan muncul setelah status Lunas',
    },
  ]

  const showPostButton =
    canRelease &&
    header.status === 'RECEIVED' &&
    !header.journal_received_id

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-500">
          <BookOpen className="w-4 h-4" />
          <p className="text-xs">Journal di-post oleh admin marketplace</p>
        </div>
        {showPostButton && (
          <button
            type="button"
            onClick={handlePostReceive}
            disabled={posting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {posting ? 'Memproses...' : 'Post Journal Receive'}
          </button>
        )}
      </div>
      {blocks.map((b) => (
        <JournalBlockView key={b.label} block={b} />
      ))}
    </div>
  )
}

function JournalBlockView({ block }: { block: JournalBlock }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-1">
          {block.label} JOURNAL
        </p>
        {block.journalId ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Journal ID: <span className="font-mono text-gray-900 dark:text-white">{block.journalId}</span>
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            {block.placeholder}
          </p>
        )}
      </div>

      {block.journalId && (
        <Link
          to={`/accounting/journals/${block.journalId}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-900/50 rounded-lg transition-colors shrink-0"
        >
          Lihat Journal
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  )
}