import { useReducer, useMemo, useCallback, useEffect, useRef } from 'react'
import type { OutstandingInvoiceRow } from '../api/apPayments.api'
import type { ApPaymentMethod } from '../api/apPayments.api'

// --- Types ---

export interface InvoiceAssignment {
  invoiceId: string
  supplierId: string
  supplierName: string
  invoiceNumber: string
  remainingAmount: number
  amountPaid: number
  dueDate: string | null
  checked: boolean
  bankAccountId: number | null
  supplierBankAccountId: number | null
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
  groupPaymentMethods: Map<string, ApPaymentMethod>
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
  | { type: 'SET_SUPPLIER_BANK_ACCOUNT'; invoiceId: string; supplierBankAccountId: number | null }
  | { type: 'SET_AMOUNT_PAID'; invoiceId: string; amountPaid: number }
  | { type: 'APPLY_ALL_BANK_ACCOUNT'; supplierId: string; bankAccountId: number }
  | { type: 'SET_GROUP_NOTES'; supplierId: string; notes: string }
  | { type: 'SET_GROUP_PAYMENT_METHOD'; supplierId: string; paymentMethod: ApPaymentMethod }
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
        bankAccountId: action.checked ? invoice.bankAccountId : null,
        supplierBankAccountId: action.checked ? invoice.supplierBankAccountId : null,
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

    case 'SET_SUPPLIER_BANK_ACCOUNT': {
      const invoice = state.invoices.get(action.invoiceId)
      if (!invoice) return state

      const newInvoices = new Map(state.invoices)
      newInvoices.set(action.invoiceId, {
        ...invoice,
        supplierBankAccountId: action.supplierBankAccountId,
      })
      return { ...state, invoices: newInvoices }
    }

    case 'SET_AMOUNT_PAID': {
      const invoice = state.invoices.get(action.invoiceId)
      if (!invoice) return state

      const newInvoices = new Map(state.invoices)
      newInvoices.set(action.invoiceId, {
        ...invoice,
        amountPaid: action.amountPaid,
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

    case 'SET_GROUP_PAYMENT_METHOD': {
      const newMethods = new Map(state.groupPaymentMethods)
      newMethods.set(action.supplierId, action.paymentMethod)
      return { ...state, groupPaymentMethods: newMethods }
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
    const validatedBankId = prefilledBankId && validBankAccountIds.has(prefilledBankId)
      ? prefilledBankId
      : null

    const supplierBanks = row.supplier_bank_accounts ?? []
    const defaultSupplierBankId =
      row.supplier_bank_account_id ??
      (supplierBanks.length === 1 ? supplierBanks[0].id : null)

    invoices.set(row.id, {
      invoiceId: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      invoiceNumber: row.invoice_number,
      remainingAmount: row.remaining_amount,
      amountPaid: row.remaining_amount, // Default: bayar penuh
      dueDate: row.due_date,
      checked: true,
      bankAccountId: validatedBankId,
      supplierBankAccountId: defaultSupplierBankId,
    })
  }

  return {
    invoices,
    groupNotes: new Map(),
    groupPaymentMethods: new Map(),
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

  const setAmountPaid = useCallback((invoiceId: string, amountPaid: number) => {
    dispatch({ type: 'SET_AMOUNT_PAID', invoiceId, amountPaid })
  }, [])

  const applyAllBankAccount = useCallback((supplierId: string, bankAccountId: number) => {
    dispatch({ type: 'APPLY_ALL_BANK_ACCOUNT', supplierId, bankAccountId })
  }, [])

  const setSupplierBankAccount = useCallback(
    (invoiceId: string, supplierBankAccountId: number | null) => {
      dispatch({ type: 'SET_SUPPLIER_BANK_ACCOUNT', invoiceId, supplierBankAccountId })
    },
    [],
  )

  const setGroupNotes = useCallback((supplierId: string, notes: string) => {
    dispatch({ type: 'SET_GROUP_NOTES', supplierId, notes })
  }, [])

  const setGroupPaymentMethod = useCallback((supplierId: string, paymentMethod: ApPaymentMethod) => {
    dispatch({ type: 'SET_GROUP_PAYMENT_METHOD', supplierId, paymentMethod })
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
        .reduce((sum, inv) => sum + inv.amountPaid, 0)

      groups.push({ supplierId, supplierName, invoices, subtotal })
    }

    groups.sort((a, b) => a.supplierName.localeCompare(b.supplierName))
    return groups
  }, [state.invoices])

  const bankAccountUsage = useMemo(() => {
    const usageMap = new Map<number, number>()

    for (const invoice of checkedInvoices) {
      if (invoice.bankAccountId != null) {
        const current = usageMap.get(invoice.bankAccountId) ?? 0
        usageMap.set(invoice.bankAccountId, current + invoice.amountPaid)
      }
    }

    return Array.from(usageMap.entries()).map(([bankAccountId, usedAmount]) => ({
      bankAccountId,
      usedAmount,
    }))
  }, [checkedInvoices])

  const grandTotal = useMemo(
    () => checkedInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0),
    [checkedInvoices],
  )

  const paymentCount = useMemo(() => {
    const combos = new Set<string>()
    for (const invoice of checkedInvoices) {
      if (invoice.bankAccountId != null) {
        const method = state.groupPaymentMethods.get(invoice.supplierId) ?? 'TRANSFER'
        combos.add(
          `${invoice.supplierId}:${invoice.bankAccountId}:${invoice.supplierBankAccountId ?? ''}:${method}`,
        )
      }
    }
    return combos.size
  }, [checkedInvoices, state.groupPaymentMethods])

  return {
    // State
    invoices: state.invoices,
    groupNotes: state.groupNotes,
    groupPaymentMethods: state.groupPaymentMethods,

    // Derived
    checkedInvoices,
    supplierGroups,
    bankAccountUsage,
    grandTotal,
    paymentCount,

    // Actions
    toggleInvoice,
    setBankAccount,
    setSupplierBankAccount,
    setAmountPaid,
    applyAllBankAccount,
    setGroupNotes,
    setGroupPaymentMethod,
  }
}
