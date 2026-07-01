import { Plus, AlertCircle, Scissors } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { SplitNotaCard } from "./SplitNotaCard";
import { useSplitInvoiceForm } from "../hooks/useSplitInvoiceForm";
import type { PurchaseInvoiceDetail } from "../api/purchaseInvoices.api";

// Re-export so existing importers (DetailPage) don't need to change their import path
export type { SplitNotaDraft } from "../types/purchaseInvoice.types";

export interface PurchaseInvoiceSplitModalProps {
  open: boolean;
  invoice: PurchaseInvoiceDetail;
  onClose: () => void;
  onSubmit: (
    splits: Array<{
      invoice_number: string;
      invoice_date: string;
      notes: string | null;
      gr_line_ids: string[];
      supplier_bank_account_id?: number | null;
    }>,
  ) => void;
  isSubmitting?: boolean;
}

export function PurchaseInvoiceSplitModal({
  open,
  invoice,
  onClose,
  onSubmit,
  isSubmitting = false,
}: PurchaseInvoiceSplitModalProps) {
  const {
    notas,
    error,
    allAssigned,
    unassignedLines,
    assignmentMap,
    supplierBankAccounts,
    toggleLine,
    addNota,
    removeNota,
    updateNota,
    handleSubmit,
  } = useSplitInvoiceForm({ invoice, open, onSubmit });

  return (
    <Dialog
      isOpen={open}
      onClose={onClose}
      size="lg"
      preventClose={isSubmitting}
    >
      <Dialog.Header>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30">
            <Scissors className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <span>Pecah Invoice</span>
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400 mt-0.5">
              {invoice.lines.length} baris — semua baris wajib dialokasi ke
              tepat satu nota
            </p>
          </div>
        </div>
      </Dialog.Header>

      <Dialog.Body>
        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Unassigned lines warning */}
        {!allAssigned && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {unassignedLines.length} baris belum dipilih — semua harus masuk
              ke salah satu nota sebelum simpan.
            </span>
          </div>
        )}

        {/* Nota cards */}
        <div className="space-y-4">
          {notas.map((nota, index) => (
            <SplitNotaCard
              key={nota.key}
              index={index}
              nota={nota}
              canRemove={notas.length > 2}
              allLines={invoice.lines}
              assignmentMap={assignmentMap}
              supplierBankAccounts={supplierBankAccounts}
              onRemove={() => removeNota(nota.key)}
              onUpdate={(patch) => updateNota(nota.key, patch)}
              onToggleLine={(grLineId) => toggleLine(nota.key, grLineId)}
            />
          ))}
        </div>

        {/* Add nota button */}
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={addNota}
          className="mt-4"
        >
          Tambah nota
        </Button>
      </Dialog.Body>

      <Dialog.Footer>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Batal
        </Button>
        <Button
          variant="primary"
          loading={isSubmitting}
          disabled={!allAssigned}
          onClick={handleSubmit}
        >
          Simpan &amp; Pecah
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
