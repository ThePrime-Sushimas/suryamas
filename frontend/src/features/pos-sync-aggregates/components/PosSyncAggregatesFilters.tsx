import React, { useState, useEffect, useRef } from "react";
import { usePosSyncAggregatesStore } from "../store/posSyncAggregates.store";
import { useBranchesStore } from "@/features/branches/store/branches.store";
import { usePaymentMethodsStore } from "@/features/payment-methods/store/paymentMethods.store";
import { Search, X, ChevronDown, Filter } from "lucide-react";
import type { AggregateStatus } from "../types/pos-sync-aggregates.types";

const STATUS_OPTIONS: { value: AggregateStatus | ""; label: string }[] = [
  { value: "", label: "ALL STATUS" },
  { value: "READY", label: "READY" },
  { value: "PENDING", label: "PENDING" },
  { value: "FAILED", label: "FAILED" },
  { value: "JOURNALED", label: "JOURNALED" },
];

const RECONCILED_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "true", label: "Sudah Direkonsiliasi" },
  { value: "false", label: "Belum Direkonsiliasi" },
];

const JOURNAL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "true", label: "Sudah Punya Jurnal" },
  { value: "false", label: "Belum Punya Jurnal" },
];

export const PosSyncAggregatesFilters: React.FC = () => {
  const { filter, setFilter, clearFilter, fetchTransactions } =
    usePosSyncAggregatesStore();
  const { branches, fetchBranches } = useBranchesStore();
  const { paymentMethods, fetchPaymentMethods } = usePaymentMethodsStore();

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(
    Array.isArray(filter.branch_ids) 
      ? filter.branch_ids 
      : filter.branch_ids ? (filter.branch_ids as string).split(",") : []
  );
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  const branchDropdownRef = useRef<HTMLDivElement>(null);
  const paymentDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize selected payments matching filter payload
  useEffect(() => {
    if (!filter.payment_method_ids || paymentMethods.length === 0) return;
    const ids = Array.isArray(filter.payment_method_ids)
      ? filter.payment_method_ids
      : (filter.payment_method_ids as string).split(",");
    
    // ids is an array of string/number, paymentMethods has id
    const names = ids.map((id) => {
      const pm = paymentMethods.find((p) => String(p.id) === String(id));
      return pm ? pm.name : null;
    }).filter(Boolean) as string[];
    
    setSelectedPayments(names);
  }, [filter.payment_method_ids, paymentMethods]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(event.target as Node)
      ) {
        setShowBranchDropdown(false);
      }
      if (
        paymentDropdownRef.current &&
        !paymentDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPaymentDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchBranches(1, 100);
    fetchPaymentMethods(1, 100);
  }, [fetchBranches, fetchPaymentMethods]);

  const handleApplyFilters = async () => {
    setIsApplyingFilters(true);
    try {
      const selectedPaymentIds = selectedPayments
        .map((name) => paymentMethods.find((pm) => pm.name === name)?.id)
        .filter((id): id is number => id !== undefined)
        .map(String);

      setFilter({
        branch_ids: selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
        payment_method_ids:
          selectedPaymentIds.length > 0 ? selectedPaymentIds : undefined,
      });

      await fetchTransactions();
    } finally {
      setIsApplyingFilters(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedBranchIds([]);
    setSelectedPayments([]);
    clearFilter();
  };

  const hasActiveFilters =
    filter.search ||
    filter.status ||
    filter.is_reconciled !== undefined ||
    filter.has_journal !== undefined ||
    filter.date_from ||
    filter.date_to ||
    selectedBranchIds.length > 0 ||
    selectedPayments.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <Filter size={15} />
          {showFilters ? "Sembunyikan" : "Tampilkan"} Filter
        </button>
        <button
          onClick={handleApplyFilters}
          disabled={isApplyingFilters}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isApplyingFilters ? "Menerapkan..." : "Terapkan Filter"}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Pencarian
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Cari cabang / ID..."
                value={filter.search || ""}
                onChange={(e) => setFilter({ search: e.target.value || undefined })}
                className="w-full pl-8 pr-8 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
              />
              {filter.search && (
                <button
                  onClick={() => setFilter({ search: undefined })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Date Range - From */}
          <div className="w-36">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Dari
            </label>
            <input
              type="date"
              value={filter.date_from || ""}
              onChange={(e) => setFilter({ date_from: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Date Range - To */}
          <div className="w-36">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Sampai
            </label>
            <input
              type="date"
              value={filter.date_to || ""}
              onChange={(e) => setFilter({ date_to: e.target.value || undefined })}
              min={filter.date_from}
              className="w-full px-2 py-1.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Branch Dropdown */}
          <div className="relative w-44" ref={branchDropdownRef}>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Cabang
            </label>
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-left flex items-center justify-between bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <span className="truncate">
                {selectedBranchIds.length === 0
                  ? "Semua Cabang"
                  : `${selectedBranchIds.length} dipilih`}
              </span>
              <ChevronDown size={14} />
            </button>
            {showBranchDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                {branches.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBranchIds.includes(b.id)}
                      onChange={() => {
                        setSelectedBranchIds((prev) =>
                          prev.includes(b.id)
                            ? prev.filter((br) => br !== b.id)
                            : [...prev, b.id]
                        );
                      }}
                      className="mr-2"
                    />
                    <span className="text-xs text-gray-900 dark:text-white">
                      {b.branch_name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method Dropdown */}
          <div className="relative w-44" ref={paymentDropdownRef}>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Metode Pembayaran
            </label>
            <button
              onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-left flex items-center justify-between bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <span className="truncate">
                {selectedPayments.length === 0
                  ? "Semua Metode"
                  : `${selectedPayments.length} dipilih`}
              </span>
              <ChevronDown size={14} />
            </button>
            {showPaymentDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                {paymentMethods.map((pm) => (
                  <label
                    key={pm.id}
                    className="flex items-center px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPayments.includes(pm.name)}
                      onChange={() => {
                        setSelectedPayments((prev) =>
                          prev.includes(pm.name)
                            ? prev.filter((p) => p !== pm.name)
                            : [...prev, pm.name]
                        );
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm truncate text-gray-900 dark:text-white">
                      {pm.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="w-36">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Status
            </label>
            <select
              value={filter.status || ""}
              onChange={(e) => setFilter({ status: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reconciliation Status */}
          <div className="w-40">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Rekonsiliasi
            </label>
            <select
              value={
                filter.is_reconciled === undefined
                  ? ""
                  : filter.is_reconciled.toString()
              }
              onChange={(e) =>
                setFilter({
                  is_reconciled:
                    e.target.value === "" ? undefined : e.target.value === "true",
                })
              }
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {RECONCILED_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Journal Status */}
          <div className="w-40">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Jurnal
            </label>
            <select
              value={
                filter.has_journal === undefined
                  ? ""
                  : filter.has_journal.toString()
              }
              onChange={(e) =>
                setFilter({
                  has_journal:
                    e.target.value === "" ? undefined : e.target.value === "true",
                })
              }
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {JOURNAL_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-red-200 dark:border-red-900/50"
            >
              Hapus Filter
            </button>
          )}
        </div>
      )}
    </div>
  );
};
