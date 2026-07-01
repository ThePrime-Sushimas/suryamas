import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InvoiceFormHeader } from "../components/InvoiceFormHeader";
import { InvoiceGrSelector } from "../components/InvoiceGrSelector";
import { InvoiceLineTableEditable } from "../components/InvoiceLineTableEditable";
import { InvoiceChargeTableEditable } from "../components/InvoiceChargeTableEditable";
import { InvoiceTotalsFooter } from "../components/InvoiceTotalsFooter";
import { usePurchaseInvoiceForm } from "../hooks/usePurchaseInvoiceForm";
import { useInvoiceTotals } from "../hooks/useInvoiceTotals";

export default function PurchaseInvoiceFormPage() {
  const navigate = useNavigate();

  const {
    isEdit,
    isFetchingPI,
    existingPI,
    // header fields
    supplierId,
    setSupplierId,
    branchId,
    setBranchId,
    invoiceNumber,
    setInvoiceNumber,
    invoiceDate,
    setInvoiceDate,
    notes,
    setNotes,
    supplierBankAccountId,
    setSupplierBankAccountId,
    // reference data
    suppliers,
    branches,
    supplierBankAccounts,
    availableGrs,
    isFetchingGrs,
    // GR selection
    selectedGrIds,
    handleGrToggle,
    // lines + charges
    lines,
    charges,
    handleLineChange,
    handleChargeChange,
    addChargeRow,
    removeChargeRow,
    allLinesTaxRateZero,
    // submit
    createPI,
    updatePI,
    handleSubmit,
  } = usePurchaseInvoiceForm();

  const totals = useInvoiceTotals(lines, charges);

  if (isEdit && isFetchingPI)
    return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Page header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/inventory/purchase-invoices")}
              aria-label="Kembali"
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
              {isEdit ? "Edit Invoice" : "Buat Invoice Baru"}
            </h1>
          </div>
          <Button
            variant="primary"
            leftIcon={<Save className="w-4 h-4" />}
            loading={createPI.isPending || updatePI.isPending}
            disabled={lines.length === 0 || createPI.isPending || updatePI.isPending}
            onClick={handleSubmit}
          >
            <span>{isEdit ? "Simpan Perubahan" : "Buat Invoice"}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* Header form + GR selector */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InvoiceFormHeader
            isEdit={isEdit}
            supplierId={supplierId}
            onSupplierChange={(id) => {
              setSupplierId(id);
              setSupplierBankAccountId(null);
            }}
            branchId={branchId}
            onBranchChange={setBranchId}
            invoiceNumber={invoiceNumber}
            onInvoiceNumberChange={setInvoiceNumber}
            invoiceDate={invoiceDate}
            onInvoiceDateChange={setInvoiceDate}
            notes={notes}
            onNotesChange={setNotes}
            supplierBankAccountId={supplierBankAccountId}
            onBankAccountChange={setSupplierBankAccountId}
            suppliers={suppliers}
            branches={branches}
            supplierBankAccounts={supplierBankAccounts}
          />

          <InvoiceGrSelector
            supplierId={supplierId}
            branchId={branchId}
            isEdit={isEdit}
            isFetchingGrs={isFetchingGrs}
            availableGrs={availableGrs}
            selectedGrIds={selectedGrIds}
            onGrToggle={handleGrToggle}
            existingGrLinks={existingPI?.gr_links}
          />
        </div>

        {/* Lines + charges + totals */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Detail Barang</h2>
            <div className="text-xs text-gray-500">{lines.length} item dipilih</div>
          </div>

          <InvoiceLineTableEditable
            lines={lines}
            onLineChange={handleLineChange}
          />

          <InvoiceChargeTableEditable
            charges={charges}
            allLinesTaxRateZero={allLinesTaxRateZero}
            onChargeChange={handleChargeChange}
            onAddCharge={addChargeRow}
            onRemoveCharge={removeChargeRow}
          />

          <InvoiceTotalsFooter
            totals={totals}
            hasCharges={charges.length > 0}
            variant="form"
          />
        </div>
      </div>
    </div>
  );
}
