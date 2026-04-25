/**
 * NonPosReconcileModal
 *
 * Modal untuk mereconcile bank statement yang bukan dari POS.
 * One-step: isi form → backend create entry + reconcile statement + auto-journal.
 */

import { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Info,
} from "lucide-react";
import { AccountSelector } from "@/features/accounting/journals/shared/AccountSelector";
import {
  bankMutationEntriesApi,
  BANK_MUTATION_ENTRY_TYPES,
  BANK_MUTATION_ENTRY_TYPE_CONFIG,
  type BankMutationEntryType,
  type ReconcileWithMutationEntryRequest,
} from "../../api/bank-mutation-entries.api";
import type { BankStatementWithMatch } from "../../types/bank-reconciliation.types";

const fmt = (n: number) =>
  n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export interface NonPosReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  statement: BankStatementWithMatch | null;
  potentialMatchCount?: number;
  onSuccess: () => void;
}

export function NonPosReconcileModal({
  isOpen,
  onClose,
  statement,
  potentialMatchCount = 0,
  onSuccess,
}: NonPosReconcileModalProps) {
  const [entryType, setEntryType] = useState<BankMutationEntryType>("BANK_FEE");
  const [description, setDescription] = useState("");
  const [coaId, setCoaId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const config = BANK_MUTATION_ENTRY_TYPE_CONFIG[entryType];
  const bankAmount = statement ? (statement.credit_amount || 0) - (statement.debit_amount || 0) : 0;

  useEffect(() => {
    if (isOpen && statement) {
      setEntryType("BANK_FEE");
      setDescription(statement.description || "");
      setCoaId("");
      setReferenceNumber(statement.reference_number || "");
      setNotes("");
      setEntryDate(statement.transaction_date ? statement.transaction_date.split("T")[0] : "");
      setError(null);
    }
  }, [isOpen, statement]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleEntryTypeChange = useCallback((type: BankMutationEntryType) => {
    setEntryType(type);
    setCoaId("");
    setShowTypeDropdown(false);
  }, []);

  const handleSubmit = async () => {
    if (!statement) return;
    if (!coaId) { setError("Pilih akun COA terlebih dahulu"); return; }
    if (!description.trim()) { setError("Deskripsi tidak boleh kosong"); return; }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: ReconcileWithMutationEntryRequest = {
        bankStatementId: statement.id,
        entryType,
        description: description.trim(),
        coaId,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        entryDate: entryDate || undefined,
      };
      await bankMutationEntriesApi.reconcile(payload);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : "Terjadi kesalahan");
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = coaId && description.trim() && !isSubmitting;

  if (!isOpen || !statement) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 px-5 py-4 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Non-POS Entry</h2>
                <p className="text-[10px] text-white/50 mt-0.5">Reconcile mutasi di luar transaksi POS</p>
              </div>
            </div>
            <button onClick={onClose} disabled={isSubmitting} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Statement info */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Statement</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{fmt(bankAmount)}</span>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300">{statement.description}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
              <span>{statement.transaction_date?.split("T")[0]}</span>
              {statement.reference_number && (<><span>·</span><span className="font-mono">{statement.reference_number}</span></>)}
            </div>
          </div>

          {/* Warning: potential POS match */}
          {potentialMatchCount > 0 && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Statement ini punya <span className="font-bold">{potentialMatchCount}</span> potential POS match. Lanjutkan hanya jika yakin ini bukan dari POS.
              </p>
            </div>
          )}

          {/* Entry Type */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tipe Mutasi</label>
            <div className="relative">
              <button
                onClick={() => setShowTypeDropdown((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${config.isDebit ? "bg-red-400" : "bg-green-400"}`} />
                  {config.label}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showTypeDropdown ? "rotate-180" : ""}`} />
              </button>
              {showTypeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                  {BANK_MUTATION_ENTRY_TYPES.map((type) => {
                    const cfg = BANK_MUTATION_ENTRY_TYPE_CONFIG[type];
                    return (
                      <button
                        key={type}
                        onClick={() => handleEntryTypeChange(type)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          type === entryType ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.isDebit ? "bg-red-400" : "bg-green-400"}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Info className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] text-gray-400">
                {config.isDebit ? "Pengeluaran — Debit COA yang dipilih, Kredit rekening bank" : "Penerimaan — Debit rekening bank, Kredit COA yang dipilih"}
              </p>
            </div>
          </div>

          {/* COA */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Akun COA <span className="text-red-400 normal-case font-normal">(wajib)</span>
            </label>
            <AccountSelector
              value={coaId}
              onChange={setCoaId}
              placeholder={config.defaultCoaHint ? `Cari "${config.defaultCoaHint}"...` : "Cari akun COA..."}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Deskripsi</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Keterangan transaksi..."
              maxLength={500}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Reference + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">No. Referensi</label>
              <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Opsional" maxLength={100}
                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tanggal Entry</label>
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Catatan</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan tambahan (opsional)..." rows={2} maxLength={1000}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none" />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-40">
              Batal
            </button>
            <button onClick={handleSubmit} disabled={!canSubmit}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {isSubmitting ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" />Menyimpan...</>) : (<><CheckCircle2 className="w-3.5 h-3.5" />Reconcile Non-POS</>)}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
