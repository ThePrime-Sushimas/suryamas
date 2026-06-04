import { useState, useMemo, useCallback, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useClassifyOpname, useOpnameClassifications } from '../api/dailyStockOpname'
import { employeesApi } from '@/features/employees/api/employees.api'
import type { EmployeeResponse } from '@/features/employees/types'
import type { ClassifyLineEntry } from '../types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClassificationModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  branchName: string
  lines: Array<{
    id: string
    product_name: string
    product_code: string
    uom: string
    variance_qty: number
  }>
  /** When true, renders content inline without modal overlay */
  inline?: boolean
}

// ─── Row State ────────────────────────────────────────────────────────────────

interface ClassificationRow {
  line_id: string
  product_name: string
  product_code: string
  uom: string
  abs_variance: number
  waste_qty: number
  shortage_qty: number
  shortage_assigned_to: string | null
  shortage_note: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ClassificationModal = ({
  isOpen,
  onClose,
  sessionId,
  branchName,
  lines,
  inline = false,
}: ClassificationModalProps) => {
  const toast = useToast()
  const classifyOpname = useClassifyOpname()

  // ── Employee search state ───────────────────────────────────────────────────
  const [employees, setEmployees] = useState<EmployeeResponse[]>([])
  const [employeeLoading, setEmployeeLoading] = useState(false)

  // ── Row state ───────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<ClassificationRow[]>([])

  // Fetch existing classifications to pre-populate when modal opens
  const { data: existingClassifications } = useOpnameClassifications(sessionId, isOpen)

  // Initialize rows from existing classifications or defaults when modal opens
  useEffect(() => {
    if (!isOpen || lines.length === 0) return

    const entries = existingClassifications?.entries ?? []

    if (entries.length > 0) {
      // Pre-populate from existing classification entries
      setRows(
        lines.map((line) => {
          const absVar = Math.abs(line.variance_qty)
          const lineEntries = entries.filter((e) => e.line_id === line.id)
          const wasteEntry = lineEntries.find((e) => e.variance_category === 'WASTE')
          const shortageEntry = lineEntries.find((e) => e.variance_category === 'SHORTAGE')

          return {
            line_id: line.id,
            product_name: line.product_name,
            product_code: line.product_code,
            uom: line.uom,
            abs_variance: absVar,
            waste_qty: wasteEntry?.qty ?? (shortageEntry ? absVar - shortageEntry.qty : absVar),
            shortage_qty: shortageEntry?.qty ?? 0,
            shortage_assigned_to: shortageEntry?.shortage_assigned_to ?? null,
            shortage_note: shortageEntry?.shortage_note ?? null,
          }
        }),
      )
    } else {
      // Default: all variance assigned to waste
      setRows(
        lines.map((line) => {
          const absVar = Math.abs(line.variance_qty)
          return {
            line_id: line.id,
            product_name: line.product_name,
            product_code: line.product_code,
            uom: line.uom,
            abs_variance: absVar,
            waste_qty: absVar,
            shortage_qty: 0,
            shortage_assigned_to: null,
            shortage_note: null,
          }
        }),
      )
    }
  }, [isOpen, lines, existingClassifications])

  // Load employees for the branch when modal opens
  useEffect(() => {
    if (!isOpen || !branchName) return

    let cancelled = false
    const loadEmployees = async () => {
      setEmployeeLoading(true)
      try {
        const result = await employeesApi.search('', 1, 100, undefined, undefined, {
          branch_name: branchName,
          is_active: 'true',
        })
        if (!cancelled) {
          setEmployees(result.data ?? [])
        }
      } catch {
        if (!cancelled) {
          setEmployees([])
        }
      } finally {
        if (!cancelled) setEmployeeLoading(false)
      }
    }
    loadEmployees()
    return () => { cancelled = true }
  }, [isOpen, branchName])

  // ── Row handlers ────────────────────────────────────────────────────────────
  const handleWasteChange = useCallback((index: number, value: number) => {
    setRows((prev) => {
      const updated = [...prev]
      const row = { ...updated[index] }
      const clamped = Math.max(0, Math.min(value, row.abs_variance))
      row.waste_qty = clamped
      row.shortage_qty = row.abs_variance - clamped
      if (row.shortage_qty === 0) {
        row.shortage_assigned_to = null
        row.shortage_note = null
      }
      updated[index] = row
      return updated
    })
  }, [])

  const handleShortageChange = useCallback((index: number, value: number) => {
    setRows((prev) => {
      const updated = [...prev]
      const row = { ...updated[index] }
      const clamped = Math.max(0, Math.min(value, row.abs_variance))
      row.shortage_qty = clamped
      row.waste_qty = row.abs_variance - clamped
      if (row.shortage_qty === 0) {
        row.shortage_assigned_to = null
        row.shortage_note = null
      }
      updated[index] = row
      return updated
    })
  }, [])

  const handleAssignedToChange = useCallback((index: number, value: string) => {
    setRows((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], shortage_assigned_to: value || null }
      return updated
    })
  }, [])

  const handleNoteChange = useCallback((index: number, value: string) => {
    setRows((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], shortage_note: value || null }
      return updated
    })
  }, [])

  // ── Validation ──────────────────────────────────────────────────────────────
  const validationErrors = useMemo(() => {
    const errors: string[] = []
    for (const row of rows) {
      if (Math.abs(row.waste_qty + row.shortage_qty - row.abs_variance) > 0.0001) {
        errors.push(`${row.product_name}: total klasifikasi tidak sama dengan variance`)
      }
      if (row.shortage_qty > 0 && !row.shortage_assigned_to) {
        errors.push(`${row.product_name}: employee harus dipilih untuk shortage`)
      }
    }
    return errors
  }, [rows])

  const isValid = validationErrors.length === 0 && rows.length > 0

  // ── Summary totals ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let totalWaste = 0
    let totalShortage = 0
    for (const row of rows) {
      totalWaste += row.waste_qty
      totalShortage += row.shortage_qty
    }
    return { totalWaste, totalShortage, totalLines: rows.length }
  }, [rows])

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isValid) return

    const entries: ClassifyLineEntry[] = []
    for (const row of rows) {
      if (row.waste_qty > 0) {
        entries.push({
          line_id: row.line_id,
          variance_category: 'WASTE',
          qty: row.waste_qty,
          shortage_assigned_to: null,
          shortage_note: null,
        })
      }
      if (row.shortage_qty > 0) {
        entries.push({
          line_id: row.line_id,
          variance_category: 'SHORTAGE',
          qty: row.shortage_qty,
          shortage_assigned_to: row.shortage_assigned_to,
          shortage_note: row.shortage_note,
        })
      }
    }

    classifyOpname.mutate(
      { sessionId, body: { entries } },
      {
        onSuccess: () => {
          toast.success('Klasifikasi variance berhasil disimpan')
          onClose()
        },
        onError: (err) => {
          toast.error(parseApiError(err, 'Gagal menyimpan klasifikasi'))
        },
      },
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!isOpen) return null

  const wrapperClass = inline
    ? 'flex flex-col h-full'
    : 'fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900'

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Klasifikasi Variance
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Pisahkan variance negatif menjadi waste dan shortage
          </p>
        </div>
        {!inline && (
          <button
            onClick={onClose}
            disabled={classifyOpname.isPending}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Table Body - scrollable */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Produk
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Variance Qty
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Qty Waste
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Qty Shortage
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">
                Assigned To
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[180px]">
                Note
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row, index) => (
              <ClassificationRowInput
                key={row.line_id}
                row={row}
                index={index}
                employees={employees}
                employeeLoading={employeeLoading}
                onWasteChange={handleWasteChange}
                onShortageChange={handleShortageChange}
                onAssignedToChange={handleAssignedToChange}
                onNoteChange={handleNoteChange}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">
                  Tidak ada item dengan variance negatif
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
              {validationErrors.slice(0, 3).map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
              {validationErrors.length > 3 && (
                <li>• ... dan {validationErrors.length - 3} error lainnya</li>
              )}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between">
          {/* Summary */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">{summary.totalLines}</span> produk
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              Total Waste:{' '}
              <span className="font-medium text-orange-600 dark:text-orange-400">
                {summary.totalWaste.toFixed(2)}
              </span>
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              Total Shortage:{' '}
              <span className="font-medium text-red-600 dark:text-red-400">
                {summary.totalShortage.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={classifyOpname.isPending}
              className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || classifyOpname.isPending}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {classifyOpname.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Simpan Klasifikasi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Row Component ────────────────────────────────────────────────────────────

interface ClassificationRowInputProps {
  row: ClassificationRow
  index: number
  employees: EmployeeResponse[]
  employeeLoading: boolean
  onWasteChange: (index: number, value: number) => void
  onShortageChange: (index: number, value: number) => void
  onAssignedToChange: (index: number, value: string) => void
  onNoteChange: (index: number, value: string) => void
}

const ClassificationRowInput = ({
  row,
  index,
  employees,
  employeeLoading,
  onWasteChange,
  onShortageChange,
  onAssignedToChange,
  onNoteChange,
}: ClassificationRowInputProps) => {
  const hasShortage = row.shortage_qty > 0
  const sumMismatch = Math.abs(row.waste_qty + row.shortage_qty - row.abs_variance) > 0.0001
  const missingEmployee = hasShortage && !row.shortage_assigned_to

  return (
    <tr className={sumMismatch || missingEmployee ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
      {/* Product */}
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 dark:text-white text-sm">
          {row.product_name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {row.product_code} · {row.uom}
        </div>
      </td>

      {/* Variance Qty (abs) */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm font-medium text-red-600 dark:text-red-400">
          {row.abs_variance.toFixed(2)}
        </span>
      </td>

      {/* Waste Qty */}
      <td className="px-4 py-3 text-right">
        <input
          type="number"
          min={0}
          max={row.abs_variance}
          step="0.01"
          value={row.waste_qty}
          onChange={(e) => onWasteChange(index, parseFloat(e.target.value) || 0)}
          className="w-24 px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </td>

      {/* Shortage Qty */}
      <td className="px-4 py-3 text-right">
        <input
          type="number"
          min={0}
          max={row.abs_variance}
          step="0.01"
          value={row.shortage_qty}
          onChange={(e) => onShortageChange(index, parseFloat(e.target.value) || 0)}
          className="w-24 px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </td>

      {/* Assigned To */}
      <td className="px-4 py-3">
        {hasShortage ? (
          <div className="relative">
            <select
              value={row.shortage_assigned_to ?? ''}
              onChange={(e) => onAssignedToChange(index, e.target.value)}
              className={`w-full px-2 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                missingEmployee
                  ? 'border-red-300 dark:border-red-600'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <option value="">
                {employeeLoading ? 'Memuat...' : '-- Pilih Karyawan --'}
              </option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} — {emp.job_position}
                </option>
              ))}
            </select>
            {missingEmployee && (
              <p className="text-xs text-red-500 mt-0.5">Wajib dipilih</p>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>

      {/* Note */}
      <td className="px-4 py-3">
        {hasShortage ? (
          <input
            type="text"
            value={row.shortage_note ?? ''}
            onChange={(e) => onNoteChange(index, e.target.value)}
            placeholder="Catatan..."
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  )
}
