import axios from "@/lib/axios";

// ─── Types ───────────────────────────────────────────────────────────────────

export const BANK_MUTATION_ENTRY_TYPES = [
  "BANK_FEE",
  "INTEREST",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "SUPPLIER_PAYMENT",
  "RECEIVABLE",
  "REFUND",
  "TAX_PAYMENT",
  "PAYROLL",
  "OTHER",
] as const;

export type BankMutationEntryType = (typeof BANK_MUTATION_ENTRY_TYPES)[number];

export const BANK_MUTATION_ENTRY_TYPE_LABELS: Record<BankMutationEntryType, string> = {
  BANK_FEE: "Biaya Administrasi Bank",
  INTEREST: "Bunga / Jasa Giro",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_OUT: "Transfer Keluar",
  SUPPLIER_PAYMENT: "Pembayaran Supplier",
  RECEIVABLE: "Penerimaan Piutang",
  REFUND: "Refund",
  TAX_PAYMENT: "Pembayaran Pajak",
  PAYROLL: "Penggajian",
  OTHER: "Lainnya",
};

export const BANK_MUTATION_ENTRY_TYPE_CONFIG: Record<
  BankMutationEntryType,
  { label: string; defaultCoaHint: string; isDebit: boolean }
> = {
  BANK_FEE:         { label: "Biaya Administrasi Bank", defaultCoaHint: "Bank Charges",                isDebit: true  },
  INTEREST:         { label: "Bunga / Jasa Giro",       defaultCoaHint: "Interest Income",              isDebit: false },
  TRANSFER_IN:      { label: "Transfer Masuk",           defaultCoaHint: "Bank",                         isDebit: false },
  TRANSFER_OUT:     { label: "Transfer Keluar",          defaultCoaHint: "Bank",                         isDebit: true  },
  SUPPLIER_PAYMENT: { label: "Pembayaran Supplier",      defaultCoaHint: "Account payable purchase",     isDebit: true  },
  RECEIVABLE:       { label: "Penerimaan Piutang",       defaultCoaHint: "receivable",                   isDebit: false },
  REFUND:           { label: "Refund",                   defaultCoaHint: "Customer Refund",              isDebit: false },
  TAX_PAYMENT:      { label: "Pembayaran Pajak",         defaultCoaHint: "tax",                          isDebit: true  },
  PAYROLL:          { label: "Penggajian",               defaultCoaHint: "Salary payable",               isDebit: true  },
  OTHER:            { label: "Lainnya",                  defaultCoaHint: "",                             isDebit: false },
};

export type BankMutationEntryStatus = "ACTIVE" | "VOIDED";

export interface BankMutationEntryDetail {
  id: string;
  entryDate: string;
  entryType: BankMutationEntryType;
  entryTypeLabel: string;
  description: string;
  amount: number;
  referenceNumber: string | null;
  bankAccountId: number | null;
  bankAccountName: string | null;
  coaId: string | null;
  coaCode: string | null;
  coaName: string | null;
  bankStatementId: number | null;
  isReconciled: boolean;
  reconciledAt: string | null;
  journalHeaderId: string | null;
  status: BankMutationEntryStatus;
  notes: string | null;
  createdAt: string;
}

export interface ReconcileWithMutationEntryRequest {
  bankStatementId: string;
  entryType: BankMutationEntryType;
  description: string;
  referenceNumber?: string;
  coaId: string;
  entryDate?: string;
  amount?: number;
  notes?: string;
}

export interface VoidMutationEntryRequest {
  voidReason: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const bankMutationEntriesApi = {
  reconcile: async (data: ReconcileWithMutationEntryRequest): Promise<BankMutationEntryDetail> => {
    const res = await axios.post("/bank-mutation-entries/reconcile", data);
    return res.data.data;
  },

  void: async (id: string, data: VoidMutationEntryRequest): Promise<void> => {
    await axios.post(`/bank-mutation-entries/${id}/void`, data);
  },

  getById: async (id: string): Promise<BankMutationEntryDetail> => {
    const res = await axios.get(`/bank-mutation-entries/${id}`);
    return res.data.data;
  },

  getCoaSuggestions: async (entryType: BankMutationEntryType) => {
    const res = await axios.get("/bank-mutation-entries/coa-suggestions", { params: { entryType } });
    return res.data.data as Array<{ id: string; account_code: string; account_name: string }>;
  },
};
