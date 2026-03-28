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
        return { text: "Ref Sama", color: "text-green-600 bg-green-50" };
      case "EXACT_AMOUNT_DATE":
        return { text: "Amount + Tanggal", color: "text-blue-600 bg-blue-50" };
      case "KEYWORD_DESC":
        return { text: "Keyword", color: "text-purple-600 bg-purple-50" };
      case "FUZZY_AMOUNT_DATE":
        return { text: "Fuzzy", color: "text-amber-600 bg-amber-50" };
      default:
        return { text: criteria, color: "text-gray-600 bg-gray-50" };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-blue-600";
    return "text-amber-600";
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Simplified */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Auto-Match Preview</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {dateRange.startDate} - {dateRange.endDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Settings Toggle - Simplified */}
          <div className="p-6 pb-0">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <Settings2 className="w-4 h-4" />
              {showAdvanced ? "Sembunyikan Pengaturan" : "Ubah Pengaturan Pencocokan"}
            </button>

            {/* Advanced Settings - Simplified */}
            {showAdvanced && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={handlePreview}
                  disabled={isPreviewLoading}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isPreviewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Terapkan
                </button>
              </div>
            )}
          </div>

          {/* Summary - Simplified */}
          {previewData && (
            <div className="mx-6 mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold">{previewData.summary.totalStatements}</span> statements
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold text-green-600">{previewData.summary.matchedStatements}</span> match
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold text-amber-600">{previewData.summary.unmatchedStatements}</span> unmatched
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab Bar - Simplified */}
          {previewData && (
            <div className="border-b border-gray-200 mt-4">
              <div className="flex gap-1 px-6">
                {[
                  { key: 'all', label: 'Semua', count: tabCounts.all },
                  { key: 'exact_ref', label: 'Ref Sama', count: tabCounts.exact_ref },
                  { key: 'exact_amount', label: 'Amount + Tanggal', count: tabCounts.exact_amount },
                  { key: 'keyword', label: 'Keyword', count: tabCounts.keyword },
                  { key: 'fuzzy', label: 'Fuzzy', count: tabCounts.fuzzy },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                      activeTab === tab.key
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selection Controls - Simplified */}
          {previewData && filteredMatches.length > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
              <span className="text-sm text-gray-600">
                {filteredMatches.filter(m => selectedIds.has(m.statementId)).length} dari {filteredMatches.length} dipilih
              </span>
              <div className="flex gap-3">
                <button
                  onClick={handleSelectTab}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {allTabSelected ? 'Hapus Pilihan Tab Ini' : 'Pilih Semua di Tab Ini'}
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Pilih Semua
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Hapus Semua
                </button>
              </div>
            </div>
          )}

          {/* Match List - Simplified */}
          <div className="p-6">
            {isPreviewLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                <p className="text-gray-500">Mencari kecocokan...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
                <p className="text-red-500 text-center">{error}</p>
                <button
                  onClick={handlePreview}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Coba Lagi
                </button>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-8 h-8 text-amber-500 mb-3" />
                <p className="text-gray-700 font-medium text-center">
                  {activeTab === 'all' 
                    ? 'Tidak ada kecocokan ditemukan' 
                    : 'Tidak ada transaksi dengan kriteria ini'}
                </p>
                <p className="text-gray-500 text-sm text-center mt-1">
                  {activeTab === 'all' 
                    ? 'Coba ubah kriteria pencocokan'
                    : 'Coba lihat tab lain atau ubah kriteria pencocokan'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
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

        {/* Footer - Simplified */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-amber-600">
            {selectedCount} transaksi akan dicocokkan
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              disabled={confirmLoading || selectedCount === 0}
              onClick={handleConfirm}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {confirmLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Cocokkan ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Match Item Component - Simplified
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
        flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all
        ${isSelected 
          ? "border-blue-400 bg-blue-50" 
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }
      `}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div
        className={`
          w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0
          ${isSelected
            ? "bg-blue-600 border-blue-600"
            : "border-gray-300"
          }
        `}
      >
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Left Side - Statement */}
      <div className="flex-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs text-gray-500">
            {new Date(match.statement.transaction_date).toLocaleDateString("id-ID")}
          </span>
          {match.statement.reference_number && (
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {match.statement.reference_number}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-800 line-clamp-2">
          {match.statement.description}
        </p>
        <p className="text-base font-semibold text-gray-900 mt-1">
          {formatCurrency(match.statement.amount)}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />

      {/* Right Side - Aggregate */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-end gap-2 flex-wrap mb-1">
          <span className="text-xs text-gray-500">
            {new Date(match.aggregate.transaction_date).toLocaleDateString("id-ID")}
          </span>
          {match.aggregate.payment_method_name && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {match.aggregate.payment_method_name}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-800 text-right">
          POS Aggregate
        </p>
        <p className="text-base font-semibold text-gray-900 text-right mt-1">
          {formatCurrency(match.aggregate.nett_amount)}
        </p>
      </div>

      {/* Match Score */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-lg font-bold ${scoreColor}`}>
          {match.matchScore}%
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${criteriaLabel.color}`}>
          {criteriaLabel.text}
        </span>
      </div>
    </div>
  );
}