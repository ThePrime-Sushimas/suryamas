import { memo } from 'react'
import { Trash2 } from 'lucide-react'
import { AccountSelector } from '../../shared/AccountSelector'
import type { JournalLine, JournalLineWithDetails } from '../../shared/journal.types'

interface Props {
  lines: (JournalLine | JournalLineWithDetails)[]
  onLineChange: (index: number, field: keyof JournalLine, value: string | number) => void
  onRemoveLine: (index: number) => void
  formatCurrency: (value: number) => string
}

function hasAccountInfo(
  line: JournalLine | JournalLineWithDetails
): line is JournalLineWithDetails {
  return 'account_code' in line && !!line.account_code
}

export const JournalLinesTable = memo(function JournalLinesTable({
  lines,
  onLineChange,
  onRemoveLine,
  formatCurrency
}: Props) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase w-10">
                #
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase min-w-[260px]">
                Akun
              </th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase w-48">
                Debit (Dr)
              </th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase w-48">
                Credit (Cr)
              </th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase w-16"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {lines.map((line, index) => {
              const isEven = index % 2 === 0

              return (
                <tr
                  key={line.line_number}
                  className={`transition-colors cursor-default border-l-4 border-transparent hover:border-blue-400 ${
                    isEven
                      ? 'bg-white dark:bg-gray-800'
                      : 'bg-gray-50/50 dark:bg-gray-700/50'
                  } hover:bg-blue-50 dark:hover:bg-blue-900/20`}
                >
                  <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {line.line_number}
                  </td>

                  <td className="px-4 py-2 relative min-w-[260px]">
                    <AccountSelector
                      value={line.account_id}
                      accountInfo={
                        hasAccountInfo(line)
                          ? {
                              account_code: line.account_code,
                              account_name: line.account_name,
                              account_type: line.account_type
                            }
                          : null
                      }
                      onChange={(accountId) =>
                        onLineChange(index, 'account_id', accountId)
                      }
                      placeholder="Pilih akun"
                      tabIndex={index * 3 + 1}
                    />
                  </td>

                  <td className="px-4 py-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      tabIndex={index * 3 + 2}
                      value={
                        line.debit_amount > 0
                          ? formatCurrency(line.debit_amount)
                          : ''
                      }
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/[^0-9]/g, '')
                        const numericValue = rawValue
                          ? parseFloat(rawValue) / 100
                          : 0
                        onLineChange(index, 'debit_amount', numericValue)
                      }}
                      onFocus={(e) => {
                        if (line.debit_amount > 0) {
                          e.target.value = String(
                            Math.round(line.debit_amount * 100)
                          )
                        }
                      }}
                      onBlur={(e) => {
                        if (line.debit_amount > 0) {
                          e.target.value = formatCurrency(line.debit_amount)
                        }
                      }}
                      placeholder="0,00"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 text-right text-base bg-green-50 dark:bg-green-900/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent font-mono"
                    />
                  </td>

                  <td className="px-4 py-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      tabIndex={index * 3 + 3}
                      value={
                        line.credit_amount > 0
                          ? formatCurrency(line.credit_amount)
                          : ''
                      }
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/[^0-9]/g, '')
                        const numericValue = rawValue
                          ? parseFloat(rawValue) / 100
                          : 0
                        onLineChange(index, 'credit_amount', numericValue)
                      }}
                      onFocus={(e) => {
                        if (line.credit_amount > 0) {
                          e.target.value = String(
                            Math.round(line.credit_amount * 100)
                          )
                        }
                      }}
                      onBlur={(e) => {
                        if (line.credit_amount > 0) {
                          e.target.value = formatCurrency(line.credit_amount)
                        }
                      }}
                      placeholder="0,00"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 text-right text-base bg-red-50 dark:bg-red-900/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-transparent font-mono"
                    />
                  </td>

                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveLine(index)}
                      disabled={lines.length <= 2}
                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={`Hapus baris ${line.line_number}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})