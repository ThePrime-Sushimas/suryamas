interface Supplier {
  id: string;
  supplier_name: string;
}

interface Branch {
  id: string;
  branch_name: string;
}

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
}

interface InvoiceFormHeaderProps {
  isEdit: boolean;
  supplierId: string;
  onSupplierChange: (id: string) => void;
  branchId: string;
  onBranchChange: (id: string) => void;
  invoiceNumber: string;
  onInvoiceNumberChange: (v: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  supplierBankAccountId: number | null;
  onBankAccountChange: (id: number | null) => void;
  suppliers: Supplier[];
  branches: Branch[];
  supplierBankAccounts: BankAccount[];
}

export function InvoiceFormHeader({
  isEdit,
  supplierId,
  onSupplierChange,
  branchId,
  onBranchChange,
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  notes,
  onNotesChange,
  supplierBankAccountId,
  onBankAccountChange,
  suppliers,
  branches,
  supplierBankAccounts,
}: InvoiceFormHeaderProps) {
  return (
    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Supplier
          </label>
          <select
            value={supplierId}
            onChange={(e) => onSupplierChange(e.target.value)}
            disabled={isEdit}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
          >
            <option value="">Pilih Supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.supplier_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Cabang
          </label>
          <select
            value={branchId}
            onChange={(e) => onBranchChange(e.target.value)}
            disabled={isEdit}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
          >
            <option value="">Pilih Cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.branch_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Nomor Invoice Supplier
          </label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => onInvoiceNumberChange(e.target.value)}
            placeholder="Contoh: INV/2026/001"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Tanggal Invoice
          </label>
          <input
            required
            type="date"
            value={invoiceDate}
            onChange={(e) => onInvoiceDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Bisa diubah. Jatuh tempo dihitung dari tanggal ini; draft dari GR otomatis memakai tanggal terima barang sampai finance menggantinya.
          </p>
        </div>
      </div>

      {supplierId && supplierBankAccounts.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Rekening Tujuan Supplier
          </label>
          <select
            value={supplierBankAccountId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onBankAccountChange(v === "" ? null : Number(v));
            }}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Pilih rekening tujuan...</option>
            {supplierBankAccounts.map((ba) => (
              <option key={ba.id} value={ba.id}>
                {ba.bank_name} — {ba.account_number} - {ba.account_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
          Catatan
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Opsional..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
        />
      </div>
    </div>
  );
}
