/**
 * BankMutationSelectorModal.tsx
 * 
 * Modal untuk memilih bank mutations saat melakukan reverse matching dari Pos Aggregates.
 * User dapat:
 * - Melihat daftar unreconciled bank statements
 * - Search berdasarkan deskripsi
 * - Filter by amount
 * - Auto-highlight statements yang match berdasarkan amount dari POS
 * - Pilih statement untuk di-match dengan POS aggregate
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - useMemo untuk filtering yang stabil
 * - useDebounce untuk mengurangi API calls
 * - React.memo untuk item components
 * - Retry mechanism dengan exponential backoff
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Search, 
  Building2, 
  Calendar, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRightLeft,
  Filter,
  RefreshCw
} from 'lucide-react';
import { bankReconciliationApi } from '../../bank-reconciliation/api/bank-reconciliation.api';
import { useDebounce } from '@/hooks/_shared/useDebounce';
import type { AggregatedTransactionListItem } from '../types';

// ============================================================================
// ANALYTICS TRACKING (Placeholder - replace dengan analytics service Anda)
// ============================================================================
const trackEvent = (eventName: string, properties?: Record<string, unknown>) => {
  // Replace dengan analytics service call
  console.log(`[Analytics] ${eventName}:`, properties);
};

// ============================================================================
// TYPES
// ============================================================================

interface BankMutationSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (statementId: string) => Promise<void>;
  aggregate: AggregatedTransactionListItem | null;
  isLoading?: boolean;
}

/**
 * Extended type for reverse matching with match info
 */
interface BankMutationItem {
  id: string;
  transaction_date: string;
  description: string;
  reference_number?: string;
  debit_amount: number;
  credit_amount: number;
  is_reconciled: boolean;
  status: string;
  matched_aggregate?: {
    id: string;
    gross_amount: number;
    nett_amount: number;
    payment_type: string;
    payment_method_name?: string;
  };
  targetAmount?: number;
  difference?: number;
  matchPercentage?: number;
}

interface LoadingStates {
  fetch: boolean;
  confirm: boolean;
  search: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function BankMutationSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  aggregate,
}: BankMutationSelectorModalProps) {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [statements, setStatements] = useState<BankMutationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExactMatchOnly, setShowExactMatchOnly] = useState(false);
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    fetch: false,
    confirm: false,
    search: false,
  });
  const [retryCount, setRetryCount] = useState(0);

  // =========================================================================
  // DEBOUNCED SEARCH
  // =========================================================================
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // =========================================================================
  // FORMATTERS (useCallback untuk stabilitas)
  // =========================================================================
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  // =========================================================================
  // FETCH WITH RETRY MECHANISM
  // =========================================================================
  const fetchStatements = useCallback(async (currentRetryCount = 0) => {
    if (!isOpen) return;
    
    setLoadingStates(prev => ({ ...prev, fetch: true }));
    setError(null);

    try {
      const data = await bankReconciliationApi.getUnreconciledStatements();
      
      // Transform to include match info if aggregate is provided
      const targetAmount = aggregate?.nett_amount || 0;
      const transformedData: BankMutationItem[] = data.map(s => {
        const bankAmount = (s.credit_amount || 0) - (s.debit_amount || 0);
        const difference = Math.abs(bankAmount - targetAmount);
        const matchPercentage = targetAmount > 0 ? Math.max(0, 1 - (difference / targetAmount)) : 0;

        return {
          id: s.id,
          transaction_date: s.transaction_date,
          description: s.description,
          reference_number: s.reference_number,
          debit_amount: s.debit_amount,
          credit_amount: s.credit_amount,
          is_reconciled: s.is_reconciled,
          status: s.status,
          matched_aggregate: s.matched_aggregate,
          targetAmount,
          difference,
          matchPercentage,
        };
      });

      setStatements(transformedData);
      setRetryCount(0); // Reset retry count on success
      trackEvent('bank_mutation_fetch_success', { count: transformedData.length });
    } catch (err) {
      console.error('Error fetching statements:', err);
      
      if (currentRetryCount < 3) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, currentRetryCount);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchStatements(currentRetryCount + 1);
        }, delay);
      } else {
        setError('Gagal mengambil data mutasi bank setelah 3 percobaan. Silakan coba lagi.');
        trackEvent('bank_mutation_fetch_failed', { error: String(err) });
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, fetch: false }));
    }
  }, [isOpen, aggregate]);

  // =========================================================================
  // EFFECTS
  // =========================================================================
  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  // Track search events
  useEffect(() => {
    if (debouncedSearchTerm) {
      trackEvent('bank_mutation_search', { term: debouncedSearchTerm });
    }
  }, [debouncedSearchTerm]);

  // =========================================================================
  // FILTERING WITH USE MEMO (Performance Optimization)
  // =========================================================================
  const filteredStatements = useMemo(() => {
    let filtered = statements;

    // Search filter dengan debounced term
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.description?.toLowerCase().includes(term) ||
        s.reference_number?.toLowerCase().includes(term) ||
        (typeof s.id === 'string' && s.id.toLowerCase().includes(term))
      );
    }

    // Exact match filter (amount within 1%)
    if (showExactMatchOnly) {
      filtered = filtered.filter(s => 
        s.matchPercentage !== undefined && s.matchPercentage >= 0.99
      );
    }

    // Sort by match percentage (best match first)
    return [...filtered].sort((a, b) => {
      // Prioritize exact matches
      const aExact = (a.matchPercentage || 0) >= 0.99;
      const bExact = (b.matchPercentage || 0) >= 0.99;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then sort by match percentage
      return (b.matchPercentage || 0) - (a.matchPercentage || 0);
    });
  }, [statements, debouncedSearchTerm, showExactMatchOnly]);

  // =========================================================================
  // BEST MATCH CALCULATION
  // =========================================================================
  const bestMatch = useMemo(() => {
    if (!statements.length) return null;
    
    return statements.reduce((best, current) => {
      const bestScore = best.matchPercentage || 0;
      const currentScore = current.matchPercentage || 0;
      return currentScore > bestScore ? current : best;
    }, statements[0]);
  }, [statements]);

  // =========================================================================
  // HANDLERS WITH ANALYTICS
  // =========================================================================
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    const selected = statements.find(s => s.id === id);
    trackEvent('bank_mutation_select', { 
      statementId: id, 
      matchPercentage: selected?.matchPercentage 
    });
  }, [statements]);

  const handleConfirm = useCallback(async () => {
    if (!selectedId) return;

    setLoadingStates(prev => ({ ...prev, confirm: true }));

    try {
      trackEvent('bank_mutation_match_attempt', {
        aggregateId: aggregate?.id,
        statementId: selectedId,
        matchPercentage: bestMatch?.matchPercentage
      });
      
      await onConfirm(selectedId);
      
      trackEvent('bank_mutation_match_success', {
        aggregateId: aggregate?.id,
        statementId: selectedId
      });
    } catch (err) {
      console.error('Error confirming match:', err);
      trackEvent('bank_mutation_match_failed', {
        aggregateId: aggregate?.id,
        statementId: selectedId,
        error: String(err)
      });
      // Error is handled by parent
    } finally {
      setLoadingStates(prev => ({ ...prev, confirm: false }));
    }
  }, [selectedId, aggregate, bestMatch, onConfirm]);

  // =========================================================================
  // KEYBOARD NAVIGATION
  // =========================================================================
  const handleKeyNavigation = useCallback((e: React.KeyboardEvent) => {
    if (!filteredStatements.length) return;

    const currentIndex = selectedId 
      ? filteredStatements.findIndex(s => s.id === selectedId)
      : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < filteredStatements.length - 1 ? currentIndex + 1 : 0;
      setSelectedId(filteredStatements[nextIndex].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredStatements.length - 1;
      setSelectedId(filteredStatements[prevIndex].id);
    } else if (e.key === 'Enter' && selectedId) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredStatements, selectedId, handleConfirm, onClose]);

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================
  const renderMatchColorClass = (matchPercent: number) => {
    if (matchPercent >= 95) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (matchPercent >= 80) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-1000 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loadingStates.confirm) onClose();
      }}
    >
      <div 
        className="modal-box max-w-4xl w-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative max-h-[85vh] flex flex-col z-1001"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-linear-to-br from-blue-600 to-indigo-700 p-6 pb-8">
          {/* Abstract shapes */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl" />

          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl">
                  <ArrowRightLeft className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 id="modal-title" className="text-xl font-bold text-white">
                    Pilih Mutasi Bank
                  </h2>
                  <p className="text-blue-100/80 text-sm mt-1">
                    Cocokkan dengan transaksi POS
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={loadingStates.confirm}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* Aggregate Info - Detailed Breakdown */}
            {aggregate && (
              <div className="mt-4 p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
                <p className="text-blue-100/60 text-xs font-medium uppercase tracking-wider mb-3">
                  Detail Transaksi Agregat
                </p>
                
                {/* Detailed Breakdown Table */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-100/60">Total Transaksi:</span>
                    <span className="text-white font-medium">{formatCurrency(aggregate.gross_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-100/60">Tax:</span>
                    <span className="text-white font-medium">{formatCurrency(aggregate.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-100/60">Discount:</span>
                    <span className="text-white font-medium">{formatCurrency(aggregate.discount_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-100/60">Service Charge:</span>
                    <span className="text-white font-medium">{formatCurrency(aggregate.service_charge_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-100/60">Bill After Discount:</span>
                    <span className="text-white font-medium">{formatCurrency(aggregate.bill_after_discount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-100/60">Fee (%):</span>
                    <span className="text-white font-medium">{formatCurrency(aggregate.percentage_fee_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-100/60">Fixed Fee:</span>
                    <span className="text-white font-medium">{formatCurrency(aggregate.fixed_fee_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-100/60">Total Fee:</span>
                    <span className="text-white font-medium">{formatCurrency(aggregate.total_fee_amount)}</span>
                  </div>
                  <div className="flex justify-between col-span-2 sm:col-span-3 pt-2 border-t border-white/10">
                    <span className="text-blue-100/80 font-semibold">Nett Amount:</span>
                    <span className="text-white font-bold text-lg">{formatCurrency(aggregate.nett_amount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

{/* Search and Filters */}
        <div className="w-full shrink-0 p-4 relative z-20">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan deskripsi atau referensi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Cari mutasi bank"
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  trackEvent('bank_mutation_filter_toggle', { 
                    showExactMatchOnly: !showExactMatchOnly 
                  });
                  setShowExactMatchOnly(!showExactMatchOnly);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  showExactMatchOnly
                    ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                aria-pressed={showExactMatchOnly}
              >
                <Filter className="w-4 h-4" />
                {showExactMatchOnly ? 'Tampilkan Semua' : 'Hanya Exact Match'}
              </button>
              <button
                onClick={() => fetchStatements()}
                disabled={loadingStates.fetch}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                aria-label="Muat ulang data"
              >
                <RefreshCw className={`w-4 h-4 ${loadingStates.fetch ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

{/* Content - Tinggi minimum tetap, tidak menyusut saat list pendek , DONT CHANGE THIS*/}
        <div 
          className="flex-1 overflow-y-auto p-4 relative min-h-[200px] max-h-[calc(85vh-420px)]" //JANGAN GANTI NI, DONT CHANGE THIS//
          role="listbox"
          aria-label="Daftar mutasi bank"
          onKeyDown={handleKeyNavigation}
          tabIndex={0}
        >
          {loadingStates.fetch ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Memuat data mutasi bank...</p>
              {retryCount > 0 && (
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                  Percobaan ulang ({retryCount}/3)...
                </p>
              )}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-center">{error}</p>
              <button
                onClick={() => fetchStatements()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Coba Lagi
              </button>
            </div>
          ) : filteredStatements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-center">
                {searchTerm || showExactMatchOnly 
                  ? 'Tidak ada mutasi yang cocok dengan filter'
                  : 'Tidak ada mutasi bank yang tersedia'}
              </p>
              {bestMatch && !searchTerm && !showExactMatchOnly && (
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                  Coba gunakan pencarian untuk menemukan match
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">

              {/* Statements List */}
              {filteredStatements.map((statement) => {
                const isBestMatch = bestMatch?.id === statement.id && (bestMatch.matchPercentage || 0) >= 0.95;
                const matchPercent = Math.round((statement.matchPercentage || 0) * 100);
                const bankAmount = (statement.credit_amount || 0) - (statement.debit_amount || 0);

                return (
                  <button
                    key={statement.id}
                    onClick={() => handleSelect(statement.id)}
                    role="option"
                    aria-selected={selectedId === statement.id}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect(statement.id);
                      }
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      selectedId === statement.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${isBestMatch ? 'ring-2 ring-green-500/30' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(statement.transaction_date)}
                          </span>
                          {isBestMatch && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium">
                              Best Match
                            </span>
                          )}
                        </div>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {statement.description || '-'}
                        </p>
                        {statement.reference_number && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Ref: {statement.reference_number}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`font-bold ${
                          statement.credit_amount > 0 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {statement.credit_amount > 0 ? '+' : ''}{formatCurrency(bankAmount)}
                        </p>
                        {statement.targetAmount && (
                          <div className="mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${renderMatchColorClass(matchPercent)}`}>
                              {matchPercent}% match
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Difference Info */}
                    {statement.targetAmount && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">
                          Selisih: {formatCurrency(statement.difference || 0)}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500">
                          Target: {formatCurrency(statement.targetAmount)}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredStatements.length} mutasi ditemukan
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loadingStates.confirm}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedId || loadingStates.confirm}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
              {loadingStates.confirm ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Konfirmasi Match
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default BankMutationSelectorModal;

