import { useReducer, useMemo, useCallback, useEffect, useRef } from 'react'
import type { OutstandingInvoiceRow } from '../api/apPayments.api'

// --- Types ---

export interface InvoiceAssignment {
  invoiceId: string
  supplierId: string
  supplierName: string
  invoiceNumber: string
  remainingAmount: number
  dueDate: string | null
  checked: boolean
  bankAccountId: number | null
}

export interface SupplierGroup {
  supplierId: string
  supplierName: string
  invoices: InvoiceAssignment[]
  subtotal: number
}

export interface BankAccountUsage {
  bankAccountId: number
  usedAmount: number
}

export interface BulkCreateState {
  invoices: Map<string, InvoiceAssignment>
  groupNotes: Map<string, string>
}

export interface BulkCreateDerived {
  checkedInvoices: InvoiceAssignment[]
  supplierGroups: SupplierGroup[]
  bankAccountUsage: BankAccountUsage[]
  grandTotal: number
  paymentCount: number
}

// --- Actions ---

type BulkCreateAction =
  | { type: 'TOGGLE_INVOICE'; invoiceId: string; checked: boolean }
  | { type: 'SET_BANK_ACCOUNT'; invoiceId: string; bankAccountId: number | null }
  | { type: 'APPLY_ALL_BANK_ACCOUNT'; supplierId: string; bankAccountId: number }
  | { type: 'SET_GROUP_NOTES'; supplierId: string; notes: string }
  | { type: 'REINITIALIZE'; state: BulkCreateState }

// --- Reducer ---

function bulkCreateReducer(state: BulkCreateState, action: BulkCreateAction): BulkCreateState {
  switch (action.type) {
    case 'TOGGLE_INVOICE': {
      const invoice = state.invoices.get(action.invoiceId)
      if (!invoice) return state

      const newInvoices = new Map(state.invoices)
      newInvoices.set(action.invoiceId, {
        ...invoice,
        checked: action.checked,
        // When unchecking, reset bankAccountId to null
        bankAccountId: action.checked ? invoice.bankAccountId : null,
      })
      return { ...state, invoices: newInvoices }
    }

    case 'SET_BANK_ACCOUNT': {
      const invoice = state.invoices.get(action.invoiceId)
      if (!invoice) return state

      const newInvoices = new Map(state.invoices)
      newInvoices.set(action.invoiceId, {
        ...invoice,
        bankAccountId: action.bankAccountId,
      })
      return { ...state, invoices: newInvoices }
    }

    case 'APPLY_ALL_BANK_ACCOUNT': {
      const newInvoices = new Map(state.invoices)
      for (const [id, invoice] of newInvoices) {
        if (invoice.supplierId === action.supplierId && invoice.checked) {
          newInvoices.set(id, {
            ...invoice,
            bankAccountId: action.bankAccountId,
          })
        }
      }
      return { ...state, invoices: newInvoices }
    }

    case 'SET_GROUP_NOTES': {
      const newGroupNotes = new Map(state.groupNotes)
      if (action.notes) {
        newGroupNotes.set(action.supplierId, action.notes)
      } else {
        newGroupNotes.delete(action.supplierId)
      }
      return { ...state, groupNotes: newGroupNotes }
    }

    case 'REINITIALIZE':
      return action.state

    default:
      return state
  }
}

// --- Initialization ---

function initializeState(
  invoiceRows: OutstandingInvoiceRow[],
  initialAssignments: Map<string, number | null>,
  validBankAccountIds: Set<number>,
): BulkCreateState {
  const invoices = new Map<string, InvoiceAssignment>()

  for (const row of invoiceRows) {
    const prefilledBankId = initialAssignments.get(row.id) ?? null
    // Validate that pre-filled bankAccountId exists in active accounts
    const validatedBankId = prefilledBankId && validBankAccountIds.has(prefilledBankId)
      ? prefilledBankId
      : null

    invoices.set(row.id, {
      invoiceId: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      invoiceNumber: row.invoice_number,
      remainingAmount: row.remaining_amount,
      dueDate: row.due_date,
      checked: true, // All invoices start checked (they were selected on the previous page)
      bankAccountId: validatedBankId,
    })
  }

  return {
    invoices,
    groupNotes: new Map(),
  }
}

// --- Hook ---

export function useBulkCreateState(
  initialInvoices: OutstandingInvoiceRow[],
  initialAssignments: Map<string, number | null> = new Map(),
  validBankAccountIds: Set<number> = new Set(),
) {
  const [state, dispatch] = useReducer(
    bulkCreateReducer,
    { invoiceRows: initialInvoices, initialAssignments, validBankAccountIds },
    (args) => initializeState(args.invoiceRows, args.initialAssignments, args.validBankAccountIds),
  )

  // Re-initialize when invoice data arrives (first load: [] → actual data)
  const initializedRef = useRef(false)
  useEffect(() => {
    if (initialInvoices.length > 0 && !initializedRef.current) {
      initializedRef.current = true
      dispatch({
        type: 'REINITIALIZE',
        state: initializeState(initialInvoices, initialAssignments, validBankAccountIds),
      })
    }
  }, [initialInvoices, initialAssignments, validBankAccountIds])

  // --- Actions ---

  const toggleInvoice = useCallback((invoiceId: string, checked: boolean) => {
    dispatch({ type: 'TOGGLE_INVOICE', invoiceId, checked })
  }, [])

  const setBankAccount = useCallback((invoiceId: string, bankAccountId: number | null) => {
    dispatch({ type: 'SET_BANK_ACCOUNT', invoiceId, bankAccountId })
  }, [])

  const applyAllBankAccount = useCallback((supplierId: string, bankAccountId: number) => {
    dispatch({ type: 'APPLY_ALL_BANK_ACCOUNT', supplierId, bankAccountId })
  }, [])

  const setGroupNotes = useCallback((supplierId: string, notes: string) => {
    dispatch({ type: 'SET_GROUP_NOTES', supplierId, notes })
  }, [])

  // --- Derived values ---

  const checkedInvoices = useMemo(
    () => Array.from(state.invoices.values()).filter((inv) => inv.checked),
    [state.invoices],
  )

  const supplierGroups = useMemo(() => {
    const groupMap = new Map<string, InvoiceAssignment[]>()

    for (const invoice of state.invoices.values()) {
      const existing = groupMap.get(invoice.supplierId)
      if (existing) {
        existing.push(invoice)
      } else {
        groupMap.set(invoice.supplierId, [invoice])
      }
    }

    const groups: SupplierGroup[] = []
    for (const [supplierId, invoices] of groupMap) {
      const supplierName = invoices[0]?.supplierName ?? ''
      const subtotal = invoices
        .filter((inv) => inv.checked)
        .reduce((sum, inv) => sum + inv.remainingAmount, 0)

      groups.push({ supplierId, supplierName, invoices, subtotal })
    }

    // Sort alphabetically by supplier name
    groups.sort((a, b) => a.supplierName.localeCompare(b.supplierName))

    return groups
  }, [state.invoices])

  const bankAccountUsage = useMemo(() => {
    const usageMap = new Map<number, number>()

    for (const invoice of checkedInvoices) {
      if (invoice.bankAccountId != null) {
        const current = usageMap.get(invoice.bankAccountId) ?? 0
        usageMap.set(invoice.bankAccountId, current + invoice.remainingAmount)
      }
    }

    return Array.from(usageMap.entries()).map(([bankAccountId, usedAmount]) => ({
      bankAccountId,
      usedAmount,
    }))
  }, [checkedInvoices])

  const grandTotal = useMemo(
    () => checkedInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0),
    [checkedInvoices],
  )

  const paymentCount = useMemo(() => {
    const combos = new Set<string>()
    for (const invoice of checkedInvoices) {
      if (invoice.bankAccountId != null) {
        combos.add(`${invoice.supplierId}:${invoice.bankAccountId}`)
      }
    }
    return combos.size
  }, [checkedInvoices])

  return {
    // State
    invoices: state.invoices,
    groupNotes: state.groupNotes,

    // Derived
    checkedInvoices,
    supplierGroups,
    bankAccountUsage,
    grandTotal,
    paymentCount,

    // Actions
    toggleInvoice,
    setBankAccount,
    applyAllBankAccount,
    setGroupNotes,
  }
}
