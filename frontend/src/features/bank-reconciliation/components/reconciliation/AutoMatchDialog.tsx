import { useState } from "react";
import ReactDOM from "react-dom";
import {
  X,
  Sparkles,
  Settings2,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { DEFAULT_MATCHING_CRITERIA } from "../../constants/bank-reconciliation.constants";
import type {
  AutoMatchRequest,
  MatchingCriteria,
} from "../../types/bank-reconciliation.types";

interface AutoMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: Omit<AutoMatchRequest, "companyId">) => Promise<void>;
  isLoading: boolean;
  dateRange: { startDate: string; endDate: string };
}

export function AutoMatchDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  dateRange,
}: AutoMatchDialogProps) {
  const [criteria, setCriteria] = useState<MatchingCriteria>(
    DEFAULT_MATCHING_CRITERIA,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      matchingCriteria: criteria,
    });
  };

  const modalContent = (
    <div className="modal modal-open bg-black/40 backdrop-blur-sm">
      <div className="modal-box max-w-lg bg-white dark:bg-gray-900 p-0 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="relative overflow-hidden bg-linear-to-br from-blue-600 to-indigo-700 p-8 pb-12">
          {/* Abstract shapes */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl" />

          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>
            <h3 className="text-2xl font-bold text-white mt-6">
              Auto-Match Intelligence
            </h3>
            <p className="text-blue-100/80 mt-2 text-sm max-w-xs leading-relaxed">
              Jalankan algoritma pencocokan pintar untuk mengaitkan transaksi
              secara otomatis.
            </p>
          </div>
        </div>

        <div className="p-8 -mt-6 bg-white dark:bg-gray-900 rounded-t-4xl relative z-10 space-y-6">
          {/* Period Card */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Periode Analisis
                </p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  {dateRange.startDate} - {dateRange.endDate}
                </p>
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors uppercase tracking-widest"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {showAdvanced
                ? "Sembunyikan Pengaturan"
                : "Ubah Pengaturan Pencocokan"}
            </button>

            {showAdvanced && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400">
                    Toleransi Nominal (IDR)
                  </label>
                  <input
                    type="number"
                    value={criteria.amountTolerance}
                    onChange={(e) =>
                      setCriteria({
                        ...criteria,
                        amountTolerance: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400">
                      Buffer Hari
                    </label>
                    <input
                      type="number"
                      value={criteria.dateBufferDays}
                      onChange={(e) =>
                        setCriteria({
                          ...criteria,
                          dateBufferDays: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400">
                      Threshold Selisih
                    </label>
                    <input
                      type="number"
                      value={criteria.differenceThreshold}
                      onChange={(e) =>
                        setCriteria({
                          ...criteria,
                          differenceThreshold: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 p-4 rounded-2xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed font-medium">
              Pencocokan otomatis akan memproses transaksi yang berstatus{" "}
              <strong>Pending</strong>. Transaksi yang terekonsiliasi manual
              tidak akan diubah.
            </p>
          </div>
        </div>

        <div className="p-8 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
          <button
            disabled={isLoading}
            onClick={onClose}
            className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all"
          >
            Nanti Saja
          </button>
          <button
            disabled={isLoading}
            onClick={handleConfirm}
            className="group relative px-10 py-3 bg-blue-600 text-white rounded-2xl text-sm font-extrabold hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-linear-to-r from-blue-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Mulai Auto-Match
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
