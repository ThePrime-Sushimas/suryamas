import { useState, useEffect, useCallback, useRef } from "react";
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
  Check,
  Square,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { DEFAULT_MATCHING_CRITERIA } from "../../constants/reconciliation.config";
import type {
  AutoMatchPreviewResponse,
  AutoMatchPreviewMatch,
  MatchingCriteria,
} from "../../types/bank-reconciliation.types";

interface AutoMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (statementIds: string[], criteria?: Partial<MatchingCriteria>) => Promise<void>;
  onPreview: (criteria?: Partial<MatchingCriteria>) => Promise<AutoMatchPreviewResponse>;
  isLoading: boolean;
  dateRange: { startDate: string; endDate: string };
}

export function AutoMatchDialog({
  isOpen,
  onClose,
  onConfirm,
  onPreview,
  isLoading,
  dateRange,
}: AutoMatchDialogProps) {
  const [criteria, setCriteria] = useState<MatchingCriteria>(
    DEFAULT_MATCHING_CRITERIA,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewData, setPreviewData] = useState<AutoMatchPreviewResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to prevent infinite loop in useEffect
  const isInitialOpen = useRef(true);
  const hasCalledPreview = useRef(false);

  const handlePreview = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isPreviewLoading) return;
    
    setIsPreviewLoading(true);
    setError(null);
    try {
      const result = await onPreview({
        amountTolerance: criteria.amountTolerance,
        dateBufferDays: criteria.dateBufferDays,
        differenceThreshold: criteria.differenceThreshold,
      });
      setPreviewData(result);
      // Auto-select all matches by default
      const allMatchIds = new Set(result.matches.map(m => m.statementId));
      setSelectedIds(allMatchIds);
      hasCalledPreview.current = true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to preview auto-match";
      setError(errorMessage);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [criteria, onPreview, isPreviewLoading]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen && isInitialOpen.current) {
      isInitialOpen.current = false;
      setPreviewData(null);
      setSelectedIds(new Set());
      setError(null);
      hasCalledPreview.current = false;
      // Auto-preview on first open only
      handlePreview();
    } else if (!isOpen) {
      // Reset when dialog closes
      isInitialOpen.current = true;
      hasCalledPreview.current = false;
    }
  }, [isOpen, handlePreview]);

  const handleToggleSelect = useCallback((statementId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(statementId)) {
        newSet.delete(statementId);
      } else {
        newSet.add(statementId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!previewData) return;
    const allMatchIds = new Set(previewData.matches.map(m => m.statementId));
    setSelectedIds(allMatchIds);
  }, [previewData]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return;
    
    setConfirmLoading(true);
    setError(null);
    try {
      await onConfirm(Array.from(selectedIds), {
        amountTolerance: criteria.amountTolerance,
        dateBufferDays: criteria.dateBufferDays,
        differenceThreshold: criteria.differenceThreshold,
      });
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to confirm auto-match";
      setError(errorMessage);
    } finally {
      setConfirmLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getMatchCriteriaLabel = (criteria: string) => {
    switch (criteria) {
      case "EXACT_REF":
        return { text: "Ref Sama", color: "text-green-600 bg-green-50" };
      case "EXACT_AMOUNT_DATE":
        return { text: "Amount + Tanggal", color: "text-blue-600 bg-blue-50" };
      case "FUZZY_AMOUNT_DATE":
        return { text: "Fuzzy Match", color: "text-amber-600 bg-amber-50" };
      default:
        return { text: criteria, color: "text-gray-600 bg-gray-50" };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-blue-600";
    return "text-amber-600";
  };

  if (!isOpen) return null;

  const selectedCount = selectedIds.size;
  const totalMatches = previewData?.matches.length || 0;
  const allSelected = totalMatches > 0 && selectedCount === totalMatches;
  const someSelected = selectedCount > 0 && selectedCount < totalMatches;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box max-w-4xl w-full bg-white dark:bg-gray-900 p-0 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="relative overflow-hidden bg-linear-to-br from-blue-600 to-indigo-700 p-8 pb-12 shrink-0">
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
              Auto-Match Preview
            </h3>
            <p className="text-blue-100/80 mt-2 text-sm max-w-xs leading-relaxed">
              Pilih transaksi yang ingin Anda cocokkan secara otomatis berdasarkan algoritma pencocokan.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Period & Settings Bar */}
          <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Period */}
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

              {/* Settings Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors uppercase tracking-widest"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {showAdvanced ? "Sembunyikan" : "Ubah Pengaturan"}
              </button>
            </div>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-3 gap-4">
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
                <button
                  onClick={handlePreview}
                  disabled={isPreviewLoading}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isPreviewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Terapkan Pengaturan
                </button>
              </div>
            )}
          </div>

          {/* Summary Bar */}
          {previewData && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-bold">{previewData.summary.totalStatements}</span> statements
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-bold text-green-600">{previewData.summary.matchedStatements}</span> match
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-bold text-amber-600">{previewData.summary.unmatchedStatements}</span> unmatched
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={allSelected || someSelected ? handleDeselectAll : handleSelectAll}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                  >
                    {allSelected || someSelected ? (
                      <>
                        <Square className="w-4 h-4" />
                        Deselect All ({selectedCount})
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4" />
                        Select All ({totalMatches})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Match List */}
          <div className="flex-1 overflow-y-auto p-6">
            {isPreviewLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Mencari kecocokan...
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
                <p className="text-red-500 dark:text-red-400 text-center">
                  {error}
                </p>
                <button
                  onClick={handlePreview}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Coba Lagi
                </button>
              </div>
            ) : previewData?.matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-8 h-8 text-amber-500 mb-4" />
                <p className="text-gray-700 dark:text-gray-300 font-bold text-center">
                  Tidak ada kecocokan ditemukan
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center mt-2">
                  Coba ubah kriteria pencocokan atau lakukan pencocokan manual
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {previewData?.matches.map((match) => (
                  <MatchItem
                    key={match.statementId}
                    match={match}
                    isSelected={selectedIds.has(match.statementId)}
                    onToggle={() => handleToggleSelect(match.statementId)}
                    getMatchCriteriaLabel={getMatchCriteriaLabel}
                    getScoreColor={getScoreColor}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 p-3 rounded-2xl">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium max-w-xs">
              {selectedCount} transaksi akan dicocokkan. Review pilihan Anda sebelum konfirmasi.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={isLoading || confirmLoading}
              onClick={onClose}
              className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all"
            >
              Batal
            </button>
            <button
              disabled={isLoading || confirmLoading || selectedCount === 0}
              onClick={handleConfirm}
              className="group relative px-10 py-3 bg-blue-600 text-white rounded-2xl text-sm font-extrabold hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 overflow-hidden"
            >
              {confirmLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Cocokkan Terpilih ({selectedCount})
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Match Item Component
interface MatchItemProps {
  match: AutoMatchPreviewMatch;
  isSelected: boolean;
  onToggle: () => void;
  getMatchCriteriaLabel: (criteria: string) => { text: string; color: string };
  getScoreColor: (score: number) => string;
  formatCurrency: (amount: number) => string;
}

function MatchItem({
  match,
  isSelected,
  onToggle,
  getMatchCriteriaLabel,
  getScoreColor,
  formatCurrency,
}: MatchItemProps) {
  const criteriaLabel = getMatchCriteriaLabel(match.matchCriteria);
  const scoreColor = getScoreColor(match.matchScore);

  return (
    <div
      className={`
        relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer
        ${isSelected 
          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" 
          : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
        }
      `}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div
        className={`
          w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0
          ${isSelected
            ? "bg-blue-600 border-blue-600"
            : "border-gray-300 dark:border-gray-600"
          }
        `}
      >
        {isSelected && <Check className="w-4 h-4 text-white" />}
      </div>

      {/* Statement Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-gray-500">
            {new Date(match.statement.transaction_date).toLocaleDateString("id-ID")}
          </span>
          {match.statement.reference_number && (
            <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {match.statement.reference_number}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
          {match.statement.description}
        </p>
        <p className="text-lg font-extrabold text-gray-900 dark:text-white mt-1">
          {formatCurrency(match.statement.amount)}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" />

      {/* Aggregate Info */}
      <div className="flex-1 min-w-0 text-right">
        <div className="flex items-center justify-end gap-2 mb-1">
          <span className="text-xs font-bold text-gray-500">
            {new Date(match.aggregate.transaction_date).toLocaleDateString("id-ID")}
          </span>
          {match.aggregate.payment_method_name && (
            <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
              {match.aggregate.payment_method_name}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
          POS Aggregate
        </p>
        <p className="text-lg font-extrabold text-gray-900 dark:text-white mt-1">
          {formatCurrency(match.aggregate.nett_amount)}
        </p>
      </div>

      {/* Match Score */}
      <div className="flex flex-col items-end gap-1 shrink-0 w-20">
        <span className={`text-xl font-bold ${scoreColor}`}>
          {match.matchScore}%
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${criteriaLabel.color}`}>
          {criteriaLabel.text}
        </span>
      </div>
    </div>
  );
}

