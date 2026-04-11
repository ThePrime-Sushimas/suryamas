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
  RefreshCw,
} from "lucide-react";
import { DEFAULT_MATCHING_CRITERIA } from "../../constants/reconciliation.config";
import type {
  AutoMatchPreviewResponse,
  AutoMatchPreviewMatch,
  MatchingCriteria,
} from "../../types/bank-reconciliation.types";
import { tailwindTheme } from "@/lib/tailwind-theme";

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
  
  const [activeTab, setActiveTab] = useState<string>('all');
  
  const isInitialOpen = useRef(true);

  const handlePreview = useCallback(async () => {
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
      setSelectedIds(new Set(result.matches.map(m => m.statementId)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to preview auto-match");
    } finally {
      setIsPreviewLoading(false);
    }
  }, [criteria, onPreview, isPreviewLoading]);

  useEffect(() => {
    if (isOpen && isInitialOpen.current) {
      isInitialOpen.current = false;
      setPreviewData(null);
      setSelectedIds(new Set());
      setError(null);
      handlePreview();
    } else if (!isOpen) {
      isInitialOpen.current = true;
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
    if (previewData) {
      setSelectedIds(new Set(previewData.matches.map(m => m.statementId)));
    }
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
      setError(err instanceof Error ? err.message : "Failed to confirm auto-match");
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
        return { text: "Ref Sama", theme: tailwindTheme.components.statusBadge.matched.container };
      case "EXACT_AMOUNT_DATE":
        return { text: "Amount + Tanggal", theme: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full" };
      case "KEYWORD_DESC":
        return { text: "Keyword", theme: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full" };
      case "FUZZY_AMOUNT_DATE":
        return { text: "Fuzzy", theme: tailwindTheme.components.statusBadge.pending.container };
      default:
        return { text: criteria, theme: "text-gray-600 bg-gray-50 px-2 py-0.5 rounded-full" };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 80) return "text-blue-600 dark:text-blue-400";
    return "text-amber-600 dark:text-amber-400";
  };

  const tabCounts = {
    all: previewData?.matches.length || 0,
    exact_ref: previewData?.matches.filter(m => m.matchCriteria === 'EXACT_REF').length || 0,
    exact_amount: previewData?.matches.filter(m => m.matchCriteria === 'EXACT_AMOUNT_DATE').length || 0,
    keyword: previewData?.matches.filter(m => m.matchCriteria === 'KEYWORD_DESC').length || 0,
    fuzzy: previewData?.matches.filter(m => m.matchCriteria === 'FUZZY_AMOUNT_DATE').length || 0,
  };

  const filteredMatches = previewData?.matches.filter(m => {
    if (activeTab === 'all') return true;
    const map: Record<string, string> = {
      exact_ref: 'EXACT_REF',
      exact_amount: 'EXACT_AMOUNT_DATE',
      keyword: 'KEYWORD_DESC',
      fuzzy: 'FUZZY_AMOUNT_DATE',
    };
    return m.matchCriteria === map[activeTab];
  }) || [];

  const handleSelectTab = () => {
    const tabIds = new Set(filteredMatches.map(m => m.statementId));
    const allTabSelected = filteredMatches.every(m => selectedIds.has(m.statementId));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allTabSelected) {
        tabIds.forEach(id => next.delete(id));
      } else {
        tabIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const allTabSelected = filteredMatches.length > 0 && 
    filteredMatches.every(m => selectedIds.has(m.statementId));

  if (!isOpen) return null;

  const selectedCount = selectedIds.size;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-xl">
              <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Auto-Match Preview</h2>
              <div className="flex items-center gap-2 mt-1">
                 <Calendar className="w-3.5 h-3.5 text-gray-400" />
                 <p className="text-sm font-medium text-gray-500">
                  {dateRange.startDate} - {dateRange.endDate}
                 </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Settings Toggle */}
          <div className="px-6 pt-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="group flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <Settings2 className="w-4 h-4 transition-transform group-hover:rotate-45" />
              {showAdvanced ? "Sembunyikan Pengaturan" : "Ubah Pengaturan Pencocokan"}
            </button>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="mt-4 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">
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
                      className={tailwindTheme.components.input}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">
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
                      className={tailwindTheme.components.input}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">
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
                      className={tailwindTheme.components.input}
                    />
                  </div>
                </div>
                <button
                  onClick={handlePreview}
                  disabled={isPreviewLoading}
                  className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isPreviewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Terapkan Perubahan
                </button>
              </div>
            )}
          </div>

          {/* Aggregated Stats */}
          {previewData && (
            <div className="px-6 mt-6">
              <div className="flex flex-wrap items-center gap-4 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                <div className="flex items-center gap-3 pr-6 border-r border-gray-200 dark:border-gray-700">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Total</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {previewData.summary.totalStatements} statements
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pr-6 border-r border-gray-200 dark:border-gray-700">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-green-600 uppercase">Matched</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {previewData.summary.matchedStatements} found
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase">Unmatched</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {previewData.summary.unmatchedStatements} missing
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Bar */}
          {previewData && (
            <div className="mt-8 px-6 border-b border-gray-100 dark:border-gray-800 space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'Semua', count: tabCounts.all },
                  { key: 'exact_ref', label: 'Ref Sama', count: tabCounts.exact_ref },
                  { key: 'exact_amount', label: 'Amount + Date', count: tabCounts.exact_amount },
                  { key: 'keyword', label: 'Keyword', count: tabCounts.keyword },
                  { key: 'fuzzy', label: 'Fuzzy', count: tabCounts.fuzzy },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`
                      px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2
                      ${activeTab === tab.key
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }
                    `}
                  >
                    {tab.label}
                    <span className={`
                      px-1.5 py-0.5 rounded-md text-[10px] font-black
                      ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}
                    `}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Selection Controls */}
              {filteredMatches.length > 0 && (
                <div className="flex items-center justify-between py-2 border-t border-gray-50 dark:border-gray-800/50">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
                    {filteredMatches.filter(m => selectedIds.has(m.statementId)).length} dari {filteredMatches.length} dipilih
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={handleSelectTab}
                      className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase"
                    >
                      {allTabSelected ? 'Deselect Tab' : 'Select Tab Only'}
                    </button>
                    <button
                      onClick={handleSelectAll}
                      className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="text-[10px] font-black text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:underline uppercase"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Match List */}
          <div className="p-6">
            {isPreviewLoading ? (
              <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-sm font-bold text-gray-400 italic">Menganalisis transaksi...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-red-500 font-bold text-center max-w-md">{error}</p>
                <button
                  onClick={handlePreview}
                  className="mt-6 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all"
                >
                  Coba Lagi
                </button>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 grayscale opacity-30">
                <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500 font-bold text-center">
                  {activeTab === 'all' 
                    ? 'Tidak ada kecocokan ditemukan' 
                    : 'Tidak ada transaksi untuk kriteria ini'}
                </p>
                <p className="text-gray-400 text-xs mt-2">Coba ubah kriteria atau pilih tab lain</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMatches.map((match) => (
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
        <div className="flex items-center justify-between p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg ${selectedCount > 0 ? 'bg-blue-600' : 'bg-gray-300'} transition-colors`}>
                <Sparkles className="w-4 h-4 text-white" />
             </div>
             <p className={`text-sm font-bold ${selectedCount > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                {selectedCount} transaksi siap dicocokkan
             </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className={tailwindTheme.components.secondaryButton}
            >
              Batal
            </button>
            <button
              disabled={confirmLoading || selectedCount === 0}
              onClick={handleConfirm}
              className={`${tailwindTheme.components.primaryButton} flex items-center gap-2 px-8 min-w-[180px]`}
            >
              {confirmLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Confirm ({selectedCount})
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
  getMatchCriteriaLabel: (criteria: string) => { text: string; theme: string };
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
  const criteria = getMatchCriteriaLabel(match.matchCriteria);
  const scoreColor = getScoreColor(match.matchScore);

  return (
    <div
      onClick={onToggle}
      className={`
        group flex items-center gap-6 p-5 rounded-3xl border cursor-pointer transition-all duration-300
        ${isSelected 
          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500" 
          : "border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        }
      `}
    >
      {/* Checkbox Icon */}
      <div
        className={`
          w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0
          ${isSelected
            ? "bg-blue-600 border-blue-600 scale-110 shadow-md shadow-blue-500/30"
            : "border-gray-200 dark:border-gray-700"
          }
        `}
      >
        {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
      </div>

      {/* Main Info - Side by Side Comparison */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-4 items-center min-w-0">
        
        {/* Statement Side */}
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Statement</span>
            {match.statement.reference_number && (
              <span className="text-[9px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded leading-none truncate">
                {match.statement.reference_number}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
            {match.statement.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-black text-gray-900 dark:text-white">
              {formatCurrency(match.statement.amount)}
            </span>
            <span className="text-[10px] text-gray-400 font-bold">
              • {new Date(match.statement.transaction_date).toLocaleDateString("id-ID", { day: '2-digit', month: 'short' })}
            </span>
          </div>
        </div>

        {/* Dynamic Connector */}
        <div className="hidden lg:flex flex-col items-center justify-center px-4">
           <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-blue-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
              <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-300'}`} />
           </div>
        </div>

        {/* Aggregate Side */}
        <div className="min-w-0 lg:text-right">
          <div className="flex items-center lg:justify-end gap-3 mb-1">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">POS Aggregate</span>
             {match.aggregate.payment_method_name && (
               <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded leading-none">
                 {match.aggregate.payment_method_name}
               </span>
             )}
          </div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate italic">
            {match.aggregate.reference_number || "System Aggregate"}
          </p>
          <div className="flex items-center lg:justify-end gap-2 mt-2">
            <span className="text-xs font-black text-gray-900 dark:text-white">
              {formatCurrency(match.aggregate.nett_amount)}
            </span>
            <span className="text-[10px] text-gray-400 font-bold">
              • {new Date(match.aggregate.transaction_date).toLocaleDateString("id-ID", { day: '2-digit', month: 'short' })}
            </span>
          </div>
        </div>
      </div>

      {/* Match Quality */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 pl-6 border-l border-gray-100 dark:border-gray-800">
        <div className="flex flex-col items-end">
           <span className="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">Score</span>
           <span className={`text-xl font-black ${scoreColor} leading-none`}>
             {match.matchScore}%
           </span>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-tight py-1 px-2.5 rounded-lg whitespace-nowrap shadow-sm ${criteria.theme}`}>
          {criteria.text}
        </span>
      </div>
    </div>
  );
}