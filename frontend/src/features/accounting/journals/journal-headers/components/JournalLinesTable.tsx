import { memo } from 'react'
import { Trash2 } from 'lucide-react'
import { AccountSelector } from '../../shared/AccountSelector'
import type { JournalLine, JournalLineWithDetails } from '../../shared/journal.types'

interface Props {
  lines: (JournalLine | JournalLineWithDetails)[]
  branchName: string
  onLineChange: (index: number, field: keyof JournalLine, value: string | number) => void
  onRemoveLine: (index: number) => void
  formatCurrency: (value: number) => string
}

// Type guard untuk memeriksa apakah line memiliki account info
function hasAccountInfo(line: JournalLine | JournalLineWithDetails): line is JournalLineWithDetails {
  return 'account_code' in line && !!line.account_code
}

export const JournalLinesTable = memo(function JournalLinesTable({
  lines,
  branchName,
  onLineChange,
  onRemoveLine,
  formatCurrency
}: Props) {
  return (
    <div className="border rounded">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[150px]">Branch</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[250px]">Account</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[200px]">Description</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-40">Debit</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-40">Credit</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="px-3 py-2 text-sm text-gray-600">{line.line_number}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={branchName}
                    disabled
                    className="w-full border rounded px-2 py-1 text-sm bg-gray-50 text-gray-600"
                  />
                </td>
                <td className="px-3 py-2 relative">
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
                    onChange={(accountId) => onLineChange(index, 'account_id', accountId)}
                    placeholder="Select account"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={line.description || ''}
                    onChange={(e) => onLineChange(index, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={line.debit_amount > 0 ? formatCurrency(line.debit_amount) : ''}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/[^0-9]/g, '')
                      const numericValue = rawValue ? parseFloat(rawValue) / 100 : 0
                      onLineChange(index, 'debit_amount', numericValue)
                    }}
                    onFocus={(e) => {
                      if (line.debit_amount > 0) {
                        e.target.value = String(Math.round(line.debit_amount * 100))
                      }
                    }}
                    onBlur={(e) => {
                      if (line.debit_amount > 0) {
                        e.target.value = formatCurrency(line.debit_amount)
                      }
                    }}
                    placeholder="0,00"
                    className="w-full border rounded px-2 py-1 text-sm text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={line.credit_amount > 0 ? formatCurrency(line.credit_amount) : ''}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/[^0-9]/g, '')
                      const numericValue = rawValue ? parseFloat(rawValue) / 100 : 0
                      onLineChange(index, 'credit_amount', numericValue)
                    }}
                    onFocus={(e) => {
                      if (line.credit_amount > 0) {
                        e.target.value = String(Math.round(line.credit_amount * 100))
                      }
                    }}
                    onBlur={(e) => {
                      if (line.credit_amount > 0) {
                        e.target.value = formatCurrency(line.credit_amount)
                      }
                    }}
                    placeholder="0,00"
                    className="w-full border rounded px-2 py-1 text-sm text-right"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveLine(index)}
                    disabled={lines.length <= 2}
                    className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})
