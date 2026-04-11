/**
 * ReconciliationWizard
 * Unified wizard replacing ManualMatchModal, AutoMatchDialog, MultiMatchModal
 *
 * Step 1 → Select Mode (Auto / Manual / Multi-Match)
 * Step 2 → Mode-specific workflow
 * Step 3 → Review & Confirm
 *
 * Entry point: tombol di BankMutationTable
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  X,
  Sparkles,
  MousePointerClick,
  Link2,
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
  Search,
  Settings2,
  RefreshCw,
  CheckCircle2,
  Calendar,
  ArrowLeft,
  ChevronDown,
  ChevronUp, 
} from "lucide-react";

import { DEFAULT_MATCHING_CRITERIA } from "../../constants/reconciliation.config";
import { posAggregatesApi } from "@/features/pos-aggregates/api/posAggregates.api";
import type {
  AggregatedTransactionListItem,
  AggregatedTransactionFilterParams,
} from "@/features/pos-aggregates/types";
import type {
  BankStatementWithMatch,
  AutoMatchPreviewResponse,
  MatchingCriteria,
} from "../../types/bank-reconciliation.types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ReconciliationMode = "auto" | "manual" | "multi";

export interface ReconciliationWizardProps {
  isOpen: boolean;
  onClose: () => void;

  // Shared data
  statements: BankStatementWithMatch[];
  dateRange: { startDate: string; endDate: string };
  isLoading?: boolean;

  // Pre-selected statements (from BankMutationTable multi-select)
  initialStatements?: BankStatementWithMatch[];

  // Handlers per mode
  onAutoMatchPreview: (
    criteria?: Partial<MatchingCriteria>
  ) => Promise<AutoMatchPreviewResponse>;
  onAutoMatchConfirm: (
    statementIds: string[],
    criteria?: Partial<MatchingCriteria>
  ) => Promise<void>;
  onManualMatchConfirm: (
    aggregateId: string,
    statementId: string,
    overrideDifference: boolean
  ) => Promise<void>;
  onMultiMatchConfirm: (
    aggregateId: string,
    statementIds: string[],
    overrideDifference: boolean
  ) => Promise<void>;

  // Optional helpers
  onFindAggregate?: (
    statementIds: string[]
  ) => Promise<AggregatedTransactionListItem | null>;
  onLoadAggregates?: () => Promise<AggregatedTransactionListItem[]>;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

const normalizeId = (id: string | number) => String(id);

// ─────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────

function StepIndicator({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels: string[];
}) {
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${done ? "bg-blue-600 text-white" : active ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-gray-100 text-gray-400"}`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`text-[10px] font-semibold whitespace-nowrap ${active ? "text-blue-600" : done ? "text-gray-500" : "text-gray-300"}`}
              >
                {labels[i]}
              </span>
            </div>
            {i < total - 1 && (
              <div
                className={`h-0.5 w-12 mx-1 mb-4 transition-all duration-300 ${done ? "bg-blue-600" : "bg-gray-100"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP 1 — Mode Selection
// ─────────────────────────────────────────────

function StepSelectMode({
  onSelect,
}: {
  onSelect: (mode: ReconciliationMode) => void;
}) {
  const modes: {
    id: ReconciliationMode;
    icon: React.ReactNode;
    title: string;
    desc: string;
    color: string;
    ring: string;
    badge?: string;
  }[] = [
    {
      id: "auto",
      icon: <Sparkles className="w-6 h-6" />,
      title: "Auto-Match",
      desc: "Cocokkan semua transaksi bank otomatis berdasarkan kriteria kecocokan",
      color: "bg-blue-600 text-white",
      ring: "ring-blue-200",
      badge: "Rekomendasi",
    },
    {
      id: "manual",
      icon: <MousePointerClick className="w-6 h-6" />,
      title: "Manual Match",
      desc: "Pilih 1 bank statement dan cocokkan dengan 1 transaksi POS secara manual",
      color: "bg-emerald-600 text-white",
      ring: "ring-emerald-200",
    },
    {
      id: "multi",
      icon: <Link2 className="w-6 h-6" />,
      title: "Multi-Match",
      desc: "Cocokkan beberapa bank statements ke 1 transaksi POS aggregate",
      color: "bg-violet-600 text-white",
      ring: "ring-violet-200",
    },
  ];

  return (
    <div className="p-8 space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Pilih metode rekonsiliasi
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Setiap metode disesuaikan untuk skenario pencocokan yang berbeda
        </p>
      </div>
      <div className="grid gap-4">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`group relative flex items-center gap-5 p-5 rounded-2xl border-2 border-transparent bg-gray-50 dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-white dark:hover:bg-gray-750 hover:shadow-md transition-all duration-200 text-left ring-0 hover:ring-4 ${m.ring}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${m.color}`}>
              {m.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white">{m.title}</span>
                {m.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                    {m.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{m.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP 2A — Auto-Match Config & Preview
// ─────────────────────────────────────────────

function StepAutoMatch({
  dateRange,
  onPreview,
  onNext,
}: {
  dateRange: { startDate: string; endDate: string };
  onPreview: (criteria?: Partial<MatchingCriteria>) => Promise<AutoMatchPreviewResponse>;
  onNext: (selectedIds: string[], criteria: Partial<MatchingCriteria>) => void;
}) {
  const [criteria, setCriteria] = useState<MatchingCriteria>(DEFAULT_MATCHING_CRITERIA);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewData, setPreviewData] = useState<AutoMatchPreviewResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const didFetch = useRef(false);

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
      setSelectedIds(new Set(result.matches.map((m) => m.statementId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat preview");
    } finally {
      setIsPreviewLoading(false);
    }
  }, [criteria, onPreview, isPreviewLoading]);

  useEffect(() => {
    if (!didFetch.current) {
      didFetch.current = true;
      handlePreview();
    }
  }, [handlePreview]);

  const tabCounts = {
    all: previewData?.matches.length || 0,
    exact_ref: previewData?.matches.filter((m) => m.matchCriteria === "EXACT_REF").length || 0,
    exact_amount: previewData?.matches.filter((m) => m.matchCriteria === "EXACT_AMOUNT_DATE").length || 0,
    keyword: previewData?.matches.filter((m) => m.matchCriteria === "KEYWORD_DESC").length || 0,
    fuzzy: previewData?.matches.filter((m) => m.matchCriteria === "FUZZY_AMOUNT_DATE").length || 0,
  };

  const filteredMatches = useMemo(
    () =>
      (previewData?.matches || []).filter((m) => {
        if (activeTab === "all") return true;
        const map: Record<string, string> = {
          exact_ref: "EXACT_REF",
          exact_amount: "EXACT_AMOUNT_DATE",
          keyword: "KEYWORD_DESC",
          fuzzy: "FUZZY_AMOUNT_DATE",
        };
        return m.matchCriteria === map[activeTab];
      }),
    [previewData, activeTab]
  );

  const allTabSelected =
    filteredMatches.length > 0 && filteredMatches.every((m) => selectedIds.has(m.statementId));

  const getLabel = (c: string) => {
    const map: Record<string, { text: string; color: string }> = {
      EXACT_REF: { text: "Ref Sama", color: "text-green-700 bg-green-50" },
      EXACT_AMOUNT_DATE: { text: "Amount + Tanggal", color: "text-blue-700 bg-blue-50" },
      KEYWORD_DESC: { text: "Keyword", color: "text-purple-700 bg-purple-50" },
      FUZZY_AMOUNT_DATE: { text: "Fuzzy", color: "text-amber-700 bg-amber-50" },
    };
    return map[c] || { text: c, color: "text-gray-600 bg-gray-50" };
  };

  const getScoreColor = (s: number) =>
    s >= 90 ? "text-green-600" : s >= 80 ? "text-blue-600" : "text-amber-600";

  return (
    <div className="flex flex-col h-full">
      {/* Settings toggle */}
      <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              {dateRange.startDate} — {dateRange.endDate}
            </p>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {showAdvanced ? "Sembunyikan" : "Pengaturan"}
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["amountTolerance", "Toleransi Nominal (IDR)"],
                  ["dateBufferDays", "Buffer Hari"],
                  ["differenceThreshold", "Threshold Selisih"],
                ] as [keyof MatchingCriteria, string][]
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    value={criteria[key]}
                    onChange={(e) =>
                      setCriteria({ ...criteria, [key]: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handlePreview}
              disabled={isPreviewLoading}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isPreviewLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Terapkan
            </button>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {previewData && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-6 text-sm">
          <span className="flex items-center gap-1.5 text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <strong>{previewData.summary.totalStatements}</strong> statements
          </span>
          <span className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <strong>{previewData.summary.matchedStatements}</strong> match
          </span>
          <span className="flex items-center gap-1.5 text-amber-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <strong>{previewData.summary.unmatchedStatements}</strong> unmatched
          </span>
          <span className="ml-auto text-blue-600 font-medium">
            {selectedIds.size} dipilih
          </span>
        </div>
      )}

      {/* Tabs */}
      {previewData && (
        <div className="border-b border-gray-100 dark:border-gray-800">
          <div className="flex gap-1 px-6 overflow-x-auto">
            {[
              { key: "all", label: "Semua", count: tabCounts.all },
              { key: "exact_ref", label: "Ref Sama", count: tabCounts.exact_ref },
              { key: "exact_amount", label: "Amount+Tgl", count: tabCounts.exact_amount },
              { key: "keyword", label: "Keyword", count: tabCounts.keyword },
              { key: "fuzzy", label: "Fuzzy", count: tabCounts.fuzzy },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px]">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selection controls */}
      {previewData && filteredMatches.length > 0 && (
        <div className="flex items-center justify-between px-6 py-2 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-500">
            {filteredMatches.filter((m) => selectedIds.has(m.statementId)).length} / {filteredMatches.length}
          </span>
          <div className="flex gap-3 text-xs">
            <button
              onClick={() => {
                const ids = new Set(filteredMatches.map((m) => m.statementId));
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (allTabSelected) ids.forEach((id) => next.delete(id));
                  else ids.forEach((id) => next.add(id));
                  return next;
                });
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {allTabSelected ? "Hapus Tab" : "Pilih Tab"}
            </button>
            <span className="text-gray-200">|</span>
            <button
              onClick={() =>
                setSelectedIds(new Set(previewData.matches.map((m) => m.statementId)))
              }
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Semua
            </button>
            <span className="text-gray-200">|</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-400 hover:text-gray-600"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Match list */}
      <div className="flex-1 overflow-y-auto p-6">
        {isPreviewLoading ? (
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <p className="text-gray-500 text-sm">Mencari kecocokan...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-red-500 text-sm text-center">{error}</p>
            <button
              onClick={handlePreview}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48">
            <AlertCircle className="w-8 h-8 text-amber-400 mb-3" />
            <p className="text-gray-600 font-medium text-sm">Tidak ada kecocokan</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMatches.map((match) => {
              const isSelected = selectedIds.has(match.statementId);
              const label = getLabel(match.matchCriteria);
              return (
                <div
                  key={match.statementId}
                  onClick={() => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(match.statementId)) next.delete(match.statementId);
                      else next.add(match.statementId);
                      return next;
                    });
                  }}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-100 dark:border-gray-800 hover:border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">{match.statement.transaction_date}</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{match.statement.description}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(match.statement.amount)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs text-gray-500">{match.aggregate.transaction_date}</p>
                    <p className="text-xs text-gray-500">{match.aggregate.payment_method_name}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(match.aggregate.nett_amount)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    <span className={`text-base font-bold ${getScoreColor(match.matchScore)}`}>
                      {match.matchScore}%
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${label.color}`}>
                      {label.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
        <button
          disabled={selectedIds.size === 0}
          onClick={() =>
            onNext(Array.from(selectedIds), {
              amountTolerance: criteria.amountTolerance,
              dateBufferDays: criteria.dateBufferDays,
              differenceThreshold: criteria.differenceThreshold,
            })
          }
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition-all"
        >
          Review ({selectedIds.size}) <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP 2B — Manual Match
// ─────────────────────────────────────────────

function StepManualMatch({
  statements,
  onNext,
}: {
  statements: BankStatementWithMatch[];
  onNext: (statementId: string, aggregateId: string, overrideDifference: boolean) => void;
}) {
  const [selectedStatement, setSelectedStatement] = useState<BankStatementWithMatch | null>(null);
  const [statementSearch, setStatementSearch] = useState("");
  const [aggregates, setAggregates] = useState<AggregatedTransactionListItem[]>([]);
  const [aggSearch, setAggSearch] = useState("");
  const [selectedAggId, setSelectedAggId] = useState<string | null>(null);
  const [overrideDifference, setOverrideDifference] = useState(false);
  const [isLoadingAgg, setIsLoadingAgg] = useState(false);

  const unreconciledStatements = useMemo(
    () => statements.filter((s) => !s.is_reconciled),
    [statements]
  );

  const filteredStatements = useMemo(() => {
    if (!statementSearch) return unreconciledStatements;
    const q = statementSearch.toLowerCase();
    return unreconciledStatements.filter(
      (s) =>
        s.description?.toLowerCase().includes(q) ||
        s.transaction_date?.includes(q)
    );
  }, [unreconciledStatements, statementSearch]);

  const filteredAggregates = useMemo(() => {
    if (!aggSearch) return aggregates;
    const q = aggSearch.toLowerCase();
    return aggregates.filter(
      (a) =>
        a.source_ref?.toLowerCase().includes(q) ||
        a.payment_method_name?.toLowerCase().includes(q) ||
        String(a.nett_amount).includes(q)
    );
  }, [aggregates, aggSearch]);

  useEffect(() => {
    setIsLoadingAgg(true);
    posAggregatesApi
      .list(1, 500, null, { is_reconciled: false } as AggregatedTransactionFilterParams)
      .then((r) => setAggregates(r.data))
      .catch(console.error)
      .finally(() => setIsLoadingAgg(false));
  }, []);

  const selectedAgg = aggregates.find((a) => a.id === selectedAggId) || null;
  const bankAmount = selectedStatement
    ? (selectedStatement.credit_amount || 0) - (selectedStatement.debit_amount || 0)
    : 0;
  const diff = selectedAgg ? bankAmount - selectedAgg.nett_amount : 0;
  const canProceed = selectedStatement && selectedAggId;

  return (
    <div className="flex h-full">
      {/* Left: Bank Statements */}
      <div className="w-1/2 border-r border-gray-100 dark:border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Bank Statement
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={statementSearch}
              onChange={(e) => setStatementSearch(e.target.value)}
              placeholder="Cari statement..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs border-none focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredStatements.map((s) => {
            const amt = (s.credit_amount || 0) - (s.debit_amount || 0);
            const isSelected = selectedStatement?.id === s.id;
            return (
              <div
                key={s.id}
                onClick={() => {
                  setSelectedStatement(s);
                  setSelectedAggId(null);
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-100 dark:border-gray-800 hover:border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-gray-400">{s.transaction_date}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 truncate mt-0.5">
                      {s.description}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 ml-2 mt-0.5" />
                  )}
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-1.5">
                  {fmt(amt)}
                </p>
              </div>
            );
          })}
          {filteredStatements.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-400 text-xs">
              Tidak ada statement
            </div>
          )}
        </div>
      </div>

      {/* Right: POS Aggregates */}
      <div className="w-1/2 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            POS Aggregate
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={aggSearch}
              onChange={(e) => setAggSearch(e.target.value)}
              placeholder="Cari aggregate..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs border-none focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoadingAgg ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            </div>
          ) : (
            filteredAggregates.map((agg) => {
              const isSelected = selectedAggId === agg.id;
              return (
                <div
                  key={agg.id}
                  onClick={() => {
                    setSelectedAggId(agg.id);
                    setOverrideDifference(false);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-100 dark:border-gray-800 hover:border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-gray-400">{agg.transaction_date}</p>
                      <p className="text-xs text-gray-500 truncate">{agg.payment_method_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">Ref: {agg.source_ref}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-2 mt-0.5" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-1.5">
                    {fmt(agg.nett_amount)}
                  </p>
                </div>
              );
            })
          )}
          {!isLoadingAgg && filteredAggregates.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-400 text-xs">
              Tidak ada aggregate
            </div>
          )}
        </div>

        {/* Diff analysis + CTA */}
        {selectedStatement && selectedAggId && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Selisih:</span>
              <span
                className={`font-bold ${Math.abs(diff) < 1 ? "text-green-600" : "text-amber-600"}`}
              >
                {fmt(diff)}
              </span>
            </div>
            {Math.abs(diff) >= 1 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideDifference}
                  onChange={(e) => setOverrideDifference(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Konfirmasi perbedaan nominal
                </span>
              </label>
            )}
            <button
              disabled={!canProceed || (Math.abs(diff) >= 1 && !overrideDifference)}
              onClick={() =>
                selectedStatement &&
                selectedAggId &&
                onNext(selectedStatement.id, selectedAggId, overrideDifference)
              }
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-all"
            >
              Review Match <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP 2C — Multi-Match
// ─────────────────────────────────────────────

function StepMultiMatch({
  statements,
  initialStatements,
  onFindAggregate,
  onLoadAggregates,
  onNext,
}: {
  statements: BankStatementWithMatch[];
  initialStatements: BankStatementWithMatch[];
  onFindAggregate?: (ids: string[]) => Promise<AggregatedTransactionListItem | null>;
  onLoadAggregates?: () => Promise<AggregatedTransactionListItem[]>;
  onNext: (aggregateId: string, statementIds: string[], overrideDifference: boolean) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialStatements.map((s) => normalizeId(s.id))
  );
  const [statSearch, setStatSearch] = useState("");
  const [aggregate, setAggregate] = useState<AggregatedTransactionListItem | null>(null);
  const [aggregates, setAggregates] = useState<AggregatedTransactionListItem[]>([]);
  const [aggSearch, setAggSearch] = useState("");
  const [showAggList, setShowAggList] = useState(false);
  const [isLoadingAgg, setIsLoadingAgg] = useState(false);
  const [isFinding, setIsFinding] = useState(false);
  const [overrideDifference, setOverrideDifference] = useState(false);

  const filteredStatements = useMemo(() => {
    const q = statSearch.toLowerCase();
    return statements.filter(
      (s) =>
        !q ||
        s.description?.toLowerCase().includes(q) ||
        s.transaction_date?.includes(q)
    );
  }, [statements, statSearch]);

  const filteredAggregates = useMemo(() => {
    const q = aggSearch.toLowerCase();
    return aggregates.filter(
      (a) =>
        !q ||
        a.source_ref?.toLowerCase().includes(q) ||
        a.payment_method_name?.toLowerCase().includes(q)
    );
  }, [aggregates, aggSearch]);

  const selectedStatements = useMemo(
    () => statements.filter((s) => selectedIds.includes(normalizeId(s.id))),
    [statements, selectedIds]
  );

  const totalSelected = selectedStatements.reduce(
    (sum, s) => sum + (s.credit_amount || 0) - (s.debit_amount || 0),
    0
  );

  const aggAmount = aggregate?.nett_amount || 0;
  const diff = totalSelected - aggAmount;
  const diffPct = aggAmount !== 0 ? (Math.abs(diff) / aggAmount) * 100 : 0;
  const withinTolerance = diffPct <= 5;

  const isAllSelected =
    filteredStatements.length > 0 &&
    filteredStatements.every((s) => selectedIds.includes(normalizeId(s.id)));

  const toggleStatement = (id: string | number) => {
    const nid = normalizeId(id);
    setSelectedIds((prev) =>
      prev.includes(nid) ? prev.filter((x) => x !== nid) : [...prev, nid]
    );
  };

  const handleToggleAll = () => {
    const ids = filteredStatements.map((s) => normalizeId(s.id));
    if (isAllSelected) setSelectedIds((p) => p.filter((x) => !ids.includes(x)));
    else setSelectedIds((p) => [...new Set([...p, ...ids])]);
  };

  const handleFindAggregate = async () => {
    if (!onFindAggregate || selectedIds.length === 0) return;
    setIsFinding(true);
    try {
      const found = await onFindAggregate(selectedIds);
      if (found) {
        setAggregate(found);
      } else {
        setShowAggList(true);
        if (aggregates.length === 0 && onLoadAggregates) {
          setIsLoadingAgg(true);
          const result = await onLoadAggregates();
          setAggregates(result);
          setIsLoadingAgg(false);
        }
      }
    } finally {
      setIsFinding(false);
    }
  };

  const handleToggleAggList = async () => {
    if (!showAggList && aggregates.length === 0 && onLoadAggregates) {
      setIsLoadingAgg(true);
      const result = await onLoadAggregates();
      setAggregates(result);
      setIsLoadingAgg(false);
    }
    setShowAggList((v) => !v);
  };

  const canProceed = aggregate && selectedIds.length > 0 && (withinTolerance || overrideDifference);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Left: Statements */}
        <div className="w-1/2 border-r border-gray-100 dark:border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Bank Statements
              </p>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={handleToggleAll}
                  className="text-violet-600 font-medium hover:text-violet-700"
                >
                  {isAllSelected ? "Deselect All" : "Select All"}
                </button>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400">{selectedIds.length} dipilih</span>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={statSearch}
                onChange={(e) => setStatSearch(e.target.value)}
                placeholder="Cari statement..."
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs border-none focus:ring-2 focus:ring-violet-500 outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {filteredStatements.map((s) => {
              const amt = (s.credit_amount || 0) - (s.debit_amount || 0);
              const isSelected = selectedIds.includes(normalizeId(s.id));
              return (
                <div
                  key={s.id}
                  onClick={() => toggleStatement(s.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-violet-300 bg-violet-50 dark:bg-violet-900/20"
                      : "border-gray-100 dark:border-gray-800 hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-violet-600 border-violet-600" : "border-gray-300"
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400">{s.transaction_date}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{s.description}</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">{fmt(amt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Aggregate */}
        <div className="w-1/2 flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              POS Aggregate
            </p>

            {/* Selected aggregate display */}
            {aggregate ? (
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl p-3 mb-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-400">Tanggal</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{aggregate.transaction_date}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Payment Method</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{aggregate.payment_method_name}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-400">Nett Amount</p>
                    <p className="text-base font-bold text-violet-600">{fmt(aggregate.nett_amount)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-3 mb-3">
                <p className="text-xs text-gray-400">Belum ada aggregate dipilih</p>
                {selectedIds.length > 0 && onFindAggregate && (
                  <button
                    onClick={handleFindAggregate}
                    disabled={isFinding}
                    className="mt-2 flex items-center gap-1.5 mx-auto px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 disabled:opacity-50"
                  >
                    {isFinding ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Search className="w-3 h-3" />
                    )}
                    Cari Otomatis
                  </button>
                )}
              </div>
            )}

            {/* Dropdown toggle */}
            <button
              onClick={handleToggleAggList}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                {isLoadingAgg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                {aggregate ? "Ubah Aggregate" : "Pilih Aggregate"}
              </span>
              {showAggList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Aggregate list (dropdown) */}
          {showAggList && (
            <div className="border-b border-gray-100 dark:border-gray-800 flex flex-col max-h-48">
              <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    value={aggSearch}
                    onChange={(e) => setAggSearch(e.target.value)}
                    placeholder="Cari aggregate..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:ring-1 focus:ring-violet-500 outline-none"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filteredAggregates.map((agg) => (
                  <button
                    key={agg.id}
                    onClick={() => {
                      setAggregate(agg);
                      setShowAggList(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 hover:bg-violet-50 dark:hover:bg-violet-900/10 border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors ${
                      aggregate?.id === agg.id ? "bg-violet-50 dark:bg-violet-900/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-white">
                          {agg.source_ref}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {agg.payment_method_name} · {agg.transaction_date}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-violet-600">{fmt(agg.nett_amount)}</p>
                    </div>
                  </button>
                ))}
                {filteredAggregates.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-4">
                    {isLoadingAgg ? "Memuat..." : "Tidak ada aggregate"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedIds.length > 0 && (
            <div className="p-4 space-y-3 flex-1">
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total dipilih:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{fmt(totalSelected)}</span>
                </div>
                {aggregate && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Target aggregate:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{fmt(aggAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-1.5">
                      <span className="text-gray-500">Selisih:</span>
                      <span
                        className={`font-bold ${withinTolerance ? "text-green-600" : "text-red-600"}`}
                      >
                        {fmt(diff)} ({diffPct.toFixed(1)}%)
                      </span>
                    </div>
                  </>
                )}
              </div>

              {aggregate && !withinTolerance && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
                    Selisih melebihi toleransi 5%
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideDifference}
                      onChange={(e) => setOverrideDifference(e.target.checked)}
                      className="rounded border-amber-300 text-amber-600"
                    />
                    <span className="text-xs text-amber-700 dark:text-amber-400">Override dan lanjutkan</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            <button
              disabled={!canProceed}
              onClick={() =>
                aggregate &&
                onNext(aggregate.id, selectedIds, overrideDifference)
              }
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-40 transition-all"
            >
              Review Multi-Match <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP 3 — Review & Confirm
// ─────────────────────────────────────────────

interface ReviewData {
  mode: ReconciliationMode;
  // Auto
  autoStatementIds?: string[];
  autoCriteria?: Partial<MatchingCriteria>;
  // Manual
  manualStatementId?: string;
  manualAggregateId?: string;
  manualOverride?: boolean;
  // Multi
  multiAggregateId?: string;
  multiStatementIds?: string[];
  multiOverride?: boolean;
}

function StepReview({
  data,
  statements,
  onConfirm,
  isLoading,
}: {
  data: ReviewData;
  statements: BankStatementWithMatch[];
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}) {
  const statMap = useMemo(
    () => new Map(statements.map((s) => [normalizeId(s.id), s])),
    [statements]
  );

  const getModeLabel = () => {
    if (data.mode === "auto") return { label: "Auto-Match", color: "bg-blue-100 text-blue-700" };
    if (data.mode === "manual") return { label: "Manual Match", color: "bg-emerald-100 text-emerald-700" };
    return { label: "Multi-Match", color: "bg-violet-100 text-violet-700" };
  };

  const modeLabel = getModeLabel();

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Konfirmasi Rekonsiliasi</h3>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${modeLabel.color}`}>
            {modeLabel.label}
          </span>
        </div>
        <p className="text-sm text-gray-500">Periksa detail sebelum menyimpan</p>
      </div>

      {data.mode === "auto" && (
        <div className="space-y-3">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
              {data.autoStatementIds?.length} transaksi akan dicocokkan otomatis
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.autoStatementIds?.map((id) => {
                const s = statMap.get(id);
                if (!s) return null;
                const amt = (s.credit_amount || 0) - (s.debit_amount || 0);
                return (
                  <div key={id} className="flex items-center justify-between py-1.5 border-b border-blue-100 dark:border-blue-800 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-300">{s.transaction_date}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 truncate max-w-xs">{s.description}</p>
                    </div>
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{fmt(amt)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {data.mode === "manual" && (() => {
        const s = data.manualStatementId ? statMap.get(data.manualStatementId) : null;
        const amt = s ? (s.credit_amount || 0) - (s.debit_amount || 0) : 0;
        return (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                  Bank Statement
                </p>
                {s ? (
                  <>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{s.transaction_date}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{s.description}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{fmt(amt)}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">—</p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                  POS Aggregate
                </p>
                <p className="text-xs text-gray-500">ID: {data.manualAggregateId?.slice(0, 8)}…</p>
              </div>
            </div>
            {data.manualOverride && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Perbedaan nominal dikonfirmasi (override)
              </div>
            )}
          </div>
        );
      })()}

      {data.mode === "multi" && (() => {
        const selectedStatements = (data.multiStatementIds || [])
          .map((id) => statMap.get(id))
          .filter(Boolean) as BankStatementWithMatch[];
        const total = selectedStatements.reduce(
          (sum, s) => sum + (s.credit_amount || 0) - (s.debit_amount || 0),
          0
        );
        return (
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-bold text-violet-600 uppercase tracking-widest mb-1">
                  Statements ({selectedStatements.length})
                </p>
                <p className="font-bold text-gray-900 dark:text-white text-sm">{fmt(total)}</p>
              </div>
              <div>
                <p className="font-bold text-violet-600 uppercase tracking-widest mb-1">
                  Aggregate
                </p>
                <p className="text-gray-500">ID: {data.multiAggregateId?.slice(0, 8)}…</p>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {selectedStatements.map((s) => {
                const amt = (s.credit_amount || 0) - (s.debit_amount || 0);
                return (
                  <div key={s.id} className="flex justify-between items-center py-1 border-b border-violet-100 dark:border-violet-800 last:border-0 text-xs">
                    <span className="text-gray-600 dark:text-gray-400 truncate max-w-xs">{s.description || s.transaction_date}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{fmt(amt)}</span>
                  </div>
                );
              })}
            </div>
            {data.multiOverride && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Perbedaan nominal dikonfirmasi (override)
              </div>
            )}
          </div>
        );
      })()}

      <div className="flex justify-end pt-2">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Konfirmasi & Simpan
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Wizard
// ─────────────────────────────────────────────

export function ReconciliationWizard({
  isOpen,
  onClose,
  statements,
  dateRange,
  isLoading = false,
  initialStatements = [],
  onAutoMatchPreview,
  onAutoMatchConfirm,
  onManualMatchConfirm,
  onMultiMatchConfirm,
  onFindAggregate,
  onLoadAggregates,
}: ReconciliationWizardProps) {
  const [step, setStep] = useState(0); // 0=mode, 1=config, 2=review
  const [mode, setMode] = useState<ReconciliationMode | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setMode(null);
      setReviewData(null);
    }
  }, [isOpen]);

  const handleSelectMode = (m: ReconciliationMode) => {
    setMode(m);
    setStep(1);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 1) { setStep(0); setMode(null); }
    else onClose();
  };

  // Step 2 → 3 bridges
  const handleAutoNext = (ids: string[], criteria: Partial<MatchingCriteria>) => {
    setReviewData({ mode: "auto", autoStatementIds: ids, autoCriteria: criteria });
    setStep(2);
  };

  const handleManualNext = (statementId: string, aggregateId: string, override: boolean) => {
    setReviewData({
      mode: "manual",
      manualStatementId: statementId,
      manualAggregateId: aggregateId,
      manualOverride: override,
    });
    setStep(2);
  };

  const handleMultiNext = (aggregateId: string, statementIds: string[], override: boolean) => {
    setReviewData({
      mode: "multi",
      multiAggregateId: aggregateId,
      multiStatementIds: statementIds,
      multiOverride: override,
    });
    setStep(2);
  };

  const handleConfirm = async () => {
    if (!reviewData) return;
    setIsConfirming(true);
    try {
      if (reviewData.mode === "auto") {
        await onAutoMatchConfirm(
          reviewData.autoStatementIds || [],
          reviewData.autoCriteria
        );
      } else if (reviewData.mode === "manual") {
        await onManualMatchConfirm(
          reviewData.manualAggregateId!,
          reviewData.manualStatementId!,
          reviewData.manualOverride || false
        );
      } else if (reviewData.mode === "multi") {
        await onMultiMatchConfirm(
          reviewData.multiAggregateId!,
          reviewData.multiStatementIds || [],
          reviewData.multiOverride || false
        );
      }
      onClose();
    } catch (err) {
      console.error("Reconciliation confirm error:", err);
    } finally {
      setIsConfirming(false);
    }
  };

  const stepLabels = ["Metode", "Konfigurasi", "Review"];
  const modeColors: Record<ReconciliationMode, string> = {
    auto: "from-blue-600 to-indigo-700",
    manual: "from-emerald-600 to-teal-700",
    multi: "from-violet-600 to-purple-700",
  };
  const headerGradient = mode ? modeColors[mode] : "from-gray-700 to-gray-800";

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute inset-y-0 right-0 flex max-w-full pointer-events-none">
        <div className="w-screen max-w-3xl pointer-events-auto animate-in slide-in-from-right duration-300">
          <div className="flex h-full flex-col bg-white dark:bg-gray-900 shadow-2xl">
            {/* Header */}
            <div className={`relative bg-linear-to-br ${headerGradient} px-6 py-6 shrink-0`}>
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {step > 0 && (
                    <button
                      onClick={handleBack}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 text-white/70" />
                    </button>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-white">Rekonsiliasi</h2>
                    <p className="text-white/60 text-xs mt-0.5">
                      {step === 0 && "Pilih metode pencocokan"}
                      {step === 1 && mode === "auto" && "Auto-Match Preview"}
                      {step === 1 && mode === "manual" && "Pilih transaksi"}
                      {step === 1 && mode === "multi" && "Multi-Statement Match"}
                      {step === 2 && "Review & Konfirmasi"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StepIndicator current={step} total={3} labels={stepLabels} />
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors ml-2"
                  >
                    <X className="w-4 h-4 text-white/70" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {step === 0 && <StepSelectMode onSelect={handleSelectMode} />}

              {step === 1 && mode === "auto" && (
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <StepAutoMatch
                    dateRange={dateRange}
                    onPreview={onAutoMatchPreview}
                    onNext={handleAutoNext}
                  />
                </div>
              )}

              {step === 1 && mode === "manual" && (
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <StepManualMatch
                    statements={statements}
                    onNext={handleManualNext}
                  />
                </div>
              )}

              {step === 1 && mode === "multi" && (
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <StepMultiMatch
                    statements={statements}
                    initialStatements={initialStatements}
                    onFindAggregate={onFindAggregate}
                    onLoadAggregates={onLoadAggregates}
                    onNext={handleMultiNext}
                  />
                </div>
              )}

              {step === 2 && reviewData && (
                <div className="flex-1 overflow-y-auto">
                  <StepReview
                    data={reviewData}
                    statements={statements}
                    onConfirm={handleConfirm}
                    isLoading={isConfirming || isLoading}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
