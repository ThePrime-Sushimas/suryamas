import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { AccountSelector } from '@/features/accounting/journals/shared/AccountSelector'
import { useExpenseCoaDefaults, useUpsertExpenseCoaDefaults } from '../api/generalApi.api'
import { EXPENSE_TYPE_OPTIONS } from '../constants'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { ExpenseType } from '../api/generalApi.api'

type RowState = Record<ExpenseType, { account_id: string; account_code?: string; account_name?: string }>

const ALL_TYPES = EXPENSE_TYPE_OPTIONS.map((o) => o.value)

function buildInitialRows(saved: { expense_type: ExpenseType; account_id: string; account_code: string; account_name: string }[]): RowState {
  const rows = {} as RowState
  for (const t of ALL_TYPES) {
    rows[t] = { account_id: '' }
  }
  for (const s of saved) {
    rows[s.expense_type] = {
      account_id: s.account_id,
      account_code: s.account_code,
      account_name: s.account_name,
    }
  }
  return rows
}

export function ExpenseCoaDefaultsPanel() {
  const toast = useToast()
  const { data: saved, isLoading } = useExpenseCoaDefaults()
  const upsert = useUpsertExpenseCoaDefaults()
  const [rows, setRows] = useState<RowState | null>(null)

  useEffect(() => {
    if (saved) setRows(buildInitialRows(saved))
  }, [saved])

  const handleSave = async () => {
    if (!rows) return
    try {
      await upsert.mutateAsync(
        ALL_TYPES.map((expense_type) => ({
          expense_type,
          account_id: rows[expense_type].account_id || null,
        })),
      )
      toast.success('Default COA tersimpan')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menyimpan default COA'))
    }
  }

  if (isLoading || !rows) {
    return <div className="p-6 text-sm text-gray-400">Memuat default COA...</div>
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Default COA per Kategori Beban</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Saat buat invoice baru, baris pertama otomatis mengisi akun ini jika kategori beban cocok.
            Jurnal tetap memakai COA per baris yang Anda pilih.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={upsert.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 shrink-0"
        >
          <Save size={14} />
          {upsert.isPending ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {EXPENSE_TYPE_OPTIONS.map(({ value, label }) => (
          <div key={value} className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:items-center">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <div className="sm:col-span-2">
              <AccountSelector
                value={rows[value].account_id}
                onChange={(accountId) =>
                  setRows((prev) => prev && ({
                    ...prev,
                    [value]: { ...prev[value], account_id: accountId },
                  }))
                }
                placeholder="Pilih akun beban default..."
                accountInfo={
                  rows[value].account_code
                    ? {
                        account_code: rows[value].account_code!,
                        account_name: rows[value].account_name!,
                        account_type: 'EXPENSE',
                      }
                    : undefined
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
