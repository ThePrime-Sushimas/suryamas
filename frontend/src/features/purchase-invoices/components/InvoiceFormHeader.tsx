import { FormField, Input, Select, DateInput, Textarea } from "@/components/ui";

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
        <FormField label="Supplier">
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={supplierId}
              onChange={(e) => onSupplierChange(e.target.value)}
              disabled={isEdit}
            >
              <option value="">Pilih Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.supplier_name}</option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Cabang">
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={branchId}
              onChange={(e) => onBranchChange(e.target.value)}
              disabled={isEdit}
            >
              <option value="">Pilih Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Nomor Invoice Supplier">
          {({ inputId, describedBy }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              type="text"
              value={invoiceNumber}
              onChange={(e) => onInvoiceNumberChange(e.target.value)}
              placeholder="Contoh: INV/2026/001"
            />
          )}
        </FormField>
        <FormField
          label="Tanggal Invoice"
          required
          helperText="Bisa diubah. Jatuh tempo dihitung dari tanggal ini; draft dari GR otomatis memakai tanggal terima barang sampai finance menggantinya."
        >
          {({ inputId, describedBy }) => (
            <DateInput
              id={inputId}
              aria-describedby={describedBy}
              required
              value={invoiceDate}
              onChange={(e) => onInvoiceDateChange(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {supplierId && supplierBankAccounts.length > 0 && (
        <FormField label="Rekening Tujuan Supplier">
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={supplierBankAccountId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onBankAccountChange(v === "" ? null : Number(v));
              }}
            >
              <option value="">Pilih rekening tujuan...</option>
              {supplierBankAccounts.map((ba) => (
                <option key={ba.id} value={ba.id}>
                  {ba.bank_name} — {ba.account_number} - {ba.account_name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}

      <FormField label="Catatan">
        {({ inputId, describedBy }) => (
          <Textarea
            id={inputId}
            aria-describedby={describedBy}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Opsional..."
            rows={2}
            className="resize-none"
          />
        )}
      </FormField>
    </div>
  );
}
