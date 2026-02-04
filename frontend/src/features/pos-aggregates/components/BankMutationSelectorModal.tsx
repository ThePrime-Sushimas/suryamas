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
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Filter
} from 'lucide-react';
import { bankReconciliationApi } from '../../bank-reconciliation/api/bank-reconciliation.api';
import type { AggregatedTransactionListItem } from '../types';

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

export function BankMutationSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  aggregate,
  isLoading: externalLoading = false,
}: BankMutationSelectorModalProps) {
  const [statements, setStatements] = useState<BankMutationItem[]>([]);
  const [filteredStatements, setFilteredStatements] = useState<BankMutationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExactMatchOnly, setShowExactMatchOnly] = useState(false);

  // Fetch unreconciled statements on mount
  const fetchStatements = useCallback(async () => {
    if (!isOpen) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const data = await bankReconciliationApi.getUnreconciledStatements();
      
      // Transform to include match info if aggregate is provided
      const targetAmount = aggregate?.nett_amount || 0;
      const transformedData: BankMutationItem[] = data.map(s => {
        const bankAmount = (s.credit_amount || 0) - (s.debit_amount || 0);
        const difference = Math.abs(bankAmount - targetAmount);
        const matchPercentage = targetAmount > 0 ? 1 - (difference / targetAmount) : 0;

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
      setFilteredStatements(transformedData);
    } catch (err) {
      console.error('Error fetching statements:', err);
      setError('Gagal mengambil data mutasi bank. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, aggregate]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  // Filter statements when search term changes
  useEffect(() => {
    let filtered = statements;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.description?.toLowerCase().includes(term) ||
        s.reference_number?.toLowerCase().includes(term) ||
        s.id?.toLowerCase().includes(term)
      );
    }

    // Exact match filter (amount within 1%)
    if (showExactMatchOnly) {
      filtered = filtered.filter(s => 
        s.matchPercentage !== undefined && s.matchPercentage >= 0.99
      );
    }

    // Sort by match percentage (best match first)
    filtered = [...filtered].sort((a, b) => {
      // Prioritize exact matches
      const aExact = (a.matchPercentage || 0) >= 0.99;
      const bExact = (b.matchPercentage || 0) >= 0.99;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then sort by match percentage
      return (b.matchPercentage || 0) - (a.matchPercentage || 0);
    });

    setFilteredStatements(filtered);
  }, [statements, searchTerm, showExactMatchOnly]);

  // Find best match based on aggregate amount
  const bestMatch = useMemo(() => {
    if (!statements.length) return null;
    
    return statements.reduce((best, current) => {
      const bestScore = best.matchPercentage || 0;
      const currentScore = current.matchPercentage || 0;
      return currentScore > bestScore ? current : best;
    }, statements[0]);
  }, [statements]);

  // Handle confirm selection
  const handleConfirm = async () => {
    if (!selectedId) return;

    try {
      await onConfirm(selectedId);
    } catch (err) {
      console.error('Error confirming match:', err);
      // Error is handled by parent
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !externalLoading) onClose();
      }}
    >
      <div className="modal-box max-w-4xl w-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative max-h-[85vh] flex flex-col">
        
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
                  <h2 className="text-xl font-bold text-white">
                    Pilih Mutasi Bank
                  </h2>
                  <p className="text-blue-100/80 text-sm mt-1">
                    Cocokkan dengan transaksi POS
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={externalLoading}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* Aggregate Info */}
            {aggregate && (
              <div className="mt-4 p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100/60 text-xs font-medium uppercase tracking-wider">
                      Transaksi POS Dipilih
                    </p>
                    <p className="text-white font-semibold mt-1">
                      {aggregate.source_ref}
                    </p>
                    <p className="text-blue-100/80 text-sm mt-0.5">
                      {aggregate.payment_method_name || 'Payment Gateway'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-100/60 text-xs font-medium uppercase tracking-wider">
                      Nominal POS
                    </p>
                    <p className="text-white font-bold text-xl mt-1">
                      {formatCurrency(aggregate.nett_amount)}
                    </p>
                    <p className="text-blue-100/80 text-sm mt-0.5">
                      {formatDate(aggregate.transaction_date)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan deskripsi atau referensi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowExactMatchOnly(!showExactMatchOnly)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  showExactMatchOnly
                    ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                {showExactMatchOnly ? 'Tampilkan Semua' : 'Hanya Exact Match'}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Memuat data mutasi bank...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-center">{error}</p>
              <button
                onClick={fetchStatements}
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
              {/* Best Match Suggestion */}
              {bestMatch && bestMatch.matchPercentage && bestMatch.matchPercentage >= 0.95 && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-green-700 dark:text-green-400 font-medium text-sm">
                      Rekomendasi: Match Terbaik
                    </p>
                  </div>
                </div>
              )}

              {/* Statements List */}
              {filteredStatements.map((statement) => {
                const isSelected = selectedId === statement.id;
                const isBestMatch = bestMatch?.id === statement.id && (bestMatch.matchPercentage || 0) >= 0.95;
                const bankAmount = (statement.credit_amount || 0) - (statement.debit_amount || 0);
                const difference = statement.difference || 0;
                const matchPercent = Math.round((statement.matchPercentage || 0) * 100);

                return (
                  <button
                    key={statement.id}
                    onClick={() => setSelectedId(statement.id)}
                    disabled={externalLoading}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
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
                        <p className="text-gray-900 dark:text-white font-medium truncate">
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
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              matchPercent >= 95 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : matchPercent >= 80
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
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
                          Selisih: {formatCurrency(difference)}
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
              disabled={externalLoading}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedId || externalLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            >
              {externalLoading ? (
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

