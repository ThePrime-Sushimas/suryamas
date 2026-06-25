import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useListNavigation } from "@/lib/urlFilters";
import {
  Wallet,
  Search,
  X,
  LayoutDashboard,
  ShieldCheck,
  FileSpreadsheet,
  GripVertical,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import { useSuppliers } from "@/features/suppliers/api/suppliers.api";
import { useBranches } from "@/features/branches/api/branches.api";
import { useCompanyBankAccounts } from "../hooks/useCompanyBankAccounts";
import { useApPaymentFilters } from "../hooks/useApPaymentFilters";
import {
  AP_PAYMENTS_LIST_PATH,
  AP_DASHBOARD_PATH,
  AP_LIST_TABS,
  type ApPaymentListTab,
} from "../constants";
import { isDateRangeInvalid } from "../utils/apPaymentFilters.url";
import {
  useApPayments,
  useApPayment,
  useDeleteApPayment,
  usePostApPaymentJournal,
  type ApPayment,
} from "../api/apPayments.api";
import { ApPaymentDeleteConfirmMessage } from "../components/ApPaymentDeleteConfirmMessage";
import { ApPaymentsShell } from "../components/ApPaymentsShell";
import {
  BulkPaymentBatchRows,
  PaymentRow,
} from "../components/BulkPaymentBatchRows";
import { groupApPaymentsForList } from "../utils/groupPaymentsByBatch";
import { OutstandingInvoicesTab } from "../components/OutstandingInvoicesTab";
import { VerifyScreenshotModal } from "../components/VerifyScreenshotModal";
import { apTheme } from "../ap-payments.theme";

/** Tabs shown in the right (Payments) panel */
const PAYMENT_TABS = AP_LIST_TABS.filter((t) => t.id !== "outstanding") as Array<{
  id: ApPaymentListTab;
  label: string;
}>;

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// ── Min/max ratio constraints for the split panels (as percentages) ──
const SPLIT_MIN_PCT = 20;
const SPLIT_MAX_PCT = 80;
const SPLIT_DEFAULT_PCT = 42; // ~3/7 of original layout

export default function ApPaymentsPage() {
  const { openDetail } = useListNavigation(AP_PAYMENTS_LIST_PATH);
  const toast = useToast();
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canDelete = hasPermission("ap_payments", "delete");
  const canUpdate = hasPermission("ap_payments", "update");

  // ── URL-synced filters (global + right panel) ──
  const {
    filters,
    searchInput,
    setSearchInput,
    debouncedSearch,
    setFilters,
    setTab,
    setPage,
    setLimit,
    apiQuery,
  } = useApPaymentFilters();

  // ── Left panel (Outstanding) filters — local state (not in URL) ──
  const [outReceivedFrom, setOutReceivedFrom] = useState("");
  const [outReceivedTo, setOutReceivedTo] = useState("");
  const [outDueFrom, setOutDueFrom] = useState("");
  const [outDueTo, setOutDueTo] = useState("");
  const [outBankAccountId, setOutBankAccountId] = useState("");

  // ── Batch expansion state ──
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(
    () => new Set(),
  );
  const autoExpandedBatchesRef = useRef<Set<string>>(new Set());

  const [deleteTarget, setDeleteTarget] = useState<ApPayment | null>(null);
  const [showVerify, setShowVerify] = useState(false);

  // ── Resizable split state ──
  const [splitPct, setSplitPct] = useState(SPLIT_DEFAULT_PCT);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: suppliersData } = useSuppliers({ limit: 100, is_active: true });
  const { data: branchesData } = useBranches({ limit: 100 });
  const { data: bankAccounts = [] } = useCompanyBankAccounts();

  // ── Right panel query ──
  const { data: payData, isLoading: payLoading } = useApPayments(apiQuery);
  const deletePayment = useDeleteApPayment();
  const postJournal = usePostApPaymentJournal();
  const deletePaymentId = deleteTarget?.id;
  const { data: deleteDetail, isLoading: deleteDetailLoading } = useApPayment(
    deletePaymentId ?? "",
  );
  const deleteInvoiceNumbers = deleteDetail?.lines?.map(
    (l) => l.invoice_number,
  );
  const isDeleteDetailLoading =
    !!deletePaymentId && deleteDetailLoading && !deleteDetail;

  const payments = payData?.data ?? [];
  const payPagination = payData?.pagination;
  const isPaidTab = filters.tab === "paid";
  const groupBulkRows = filters.tab === "draft" || filters.tab === "all";

  const paymentGroups = useMemo(
    () =>
      groupBulkRows
        ? groupApPaymentsForList(payments)
        : payments.map((p) => ({ kind: "single" as const, payment: p })),
    [payments, groupBulkRows],
  );

  useEffect(() => {
    if (!groupBulkRows) return;
    const newlySeen = [
      ...new Set(
        payments
          .map((p) => p.bulk_payment_batch_id)
          .filter(
            (id): id is string =>
              !!id && !autoExpandedBatchesRef.current.has(id),
          ),
      ),
    ];
    if (newlySeen.length === 0) return;
    for (const id of newlySeen) autoExpandedBatchesRef.current.add(id);
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      for (const id of newlySeen) next.add(id);
      return next;
    });
  }, [payments, groupBulkRows]);

  const toggleBatch = useCallback((batchId: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }, []);

  // ── Drag-to-resize handlers ──
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawPct = ((ev.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(SPLIT_MAX_PCT, Math.max(SPLIT_MIN_PCT, rawPct));
      setSplitPct(clamped);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleDragDoubleClick = useCallback(() => {
    setSplitPct(SPLIT_DEFAULT_PCT);
  }, []);

  const rowHandlers = {
    isPaidTab,
    canUpdate,
    canDelete,
    onOpen: (paymentId: string) =>
      openDetail(`${AP_PAYMENTS_LIST_PATH}/${paymentId}`),
    onDelete: setDeleteTarget,
    onPostJournal: async (p: ApPayment) => {
      try {
        await postJournal.mutateAsync(p.id);
        toast.success(`Journal ${p.payment_number} di-post`);
      } catch {
        // Error toast sudah ditangani oleh onError di usePostApPaymentJournal
      }
    },
    postJournalPending: postJournal.isPending,
    fmtCurrency,
    fmtDate,
  };

  // ── Outstanding filters object (passed to OutstandingInvoicesTab) ──
  const outstandingFilters = useMemo(() => ({
    supplierId: filters.supplierId,
    branchId: filters.branchId,
    search: debouncedSearch,
    dateFrom: outReceivedFrom,
    dateTo: outReceivedTo,
    dueFrom: outDueFrom,
    dueTo: outDueTo,
    assignedBankAccountId: outBankAccountId
      ? Number(outBankAccountId)
      : undefined,
  }), [filters.supplierId, filters.branchId, debouncedSearch, outReceivedFrom, outReceivedTo, outDueFrom, outDueTo, outBankAccountId]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePayment.mutateAsync(deleteTarget.id);
      toast.success("Pembayaran dihapus");
    } catch {
      // Error toast sudah ditangani oleh onError di useDeleteApPayment
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── Shared filter panel (rendered in both desktop & mobile) ──
  const outstandingPanelFilters = (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Tgl Terima:
          </span>
          <input
            type="date"
            value={outReceivedFrom}
            onChange={(e) => setOutReceivedFrom(e.target.value)}
            className={`${apTheme.select} text-xs py-1!`}
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="date"
            value={outReceivedTo}
            onChange={(e) => setOutReceivedTo(e.target.value)}
            className={`${apTheme.select} text-xs py-1!`}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Jatuh Tempo:
          </span>
          <input
            type="date"
            value={outDueFrom}
            onChange={(e) => setOutDueFrom(e.target.value)}
            className={`${apTheme.select} text-xs py-1!`}
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="date"
            value={outDueTo}
            onChange={(e) => setOutDueTo(e.target.value)}
            className={`${apTheme.select} text-xs py-1!`}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Rek. Bayar:
          </span>
          <select
            value={outBankAccountId}
            onChange={(e) => setOutBankAccountId(e.target.value)}
            className={`${apTheme.select} text-xs py-1!`}
          >
            <option value="">Semua</option>
            <option value="-1">Belum diset</option>
            {bankAccounts.map((ba) => (
              <option key={ba.id} value={ba.id}>
                {ba.bank_name} - {ba.account_number} - {ba.account_name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isDateRangeInvalid(outReceivedFrom, outReceivedTo) && (
        <p className="mt-1 text-xs text-red-600">
          Tanggal terima awal harus sebelum akhir
        </p>
      )}
      {isDateRangeInvalid(outDueFrom, outDueTo) && (
        <p className="mt-1 text-xs text-red-600">
          Jatuh tempo awal harus sebelum akhir
        </p>
      )}
    </>
  );

  const paymentPanelFilters = (
    <>
      {/* Payment sub-tabs */}
      <div className="flex gap-1 mt-2 overflow-x-auto">
        {PAYMENT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filters.tab === tab.id
                ? apTheme.listTabActive
                : apTheme.listTabInactive
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Panel-specific date filters */}
      <div className="flex flex-wrap gap-2 mt-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Tgl Bayar:
          </span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ dateFrom: e.target.value })}
            className={`${apTheme.select} text-xs py-1!`}
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ dateTo: e.target.value })}
            className={`${apTheme.select} text-xs py-1!`}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Jatuh Tempo:
          </span>
          <input
            type="date"
            value={filters.dueDateFrom}
            onChange={(e) => setFilters({ dueDateFrom: e.target.value })}
            className={`${apTheme.select} text-xs py-1!`}
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="date"
            value={filters.dueDateTo}
            onChange={(e) => setFilters({ dueDateTo: e.target.value })}
            className={`${apTheme.select} text-xs py-1!`}
          />
        </div>
      </div>
      {isDateRangeInvalid(filters.dateFrom, filters.dateTo) && (
        <p className="mt-1 text-xs text-red-600">
          Tanggal bayar awal harus sebelum akhir
        </p>
      )}
      {isDateRangeInvalid(filters.dueDateFrom, filters.dueDateTo) && (
        <p className="mt-1 text-xs text-red-600">
          Jatuh tempo awal harus sebelum akhir
        </p>
      )}
    </>
  );

  const paymentTable = (
    <>
      {payLoading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={apTheme.skeleton} />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12">
          <p className={apTheme.muted}>Belum ada pembayaran</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-rose-200/80 dark:border-gray-700">
                <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                  Supplier
                </th>
                <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                  Tgl Bayar
                </th>
                <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                  Total
                </th>
                <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                  Status
                </th>
                <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                  Metode Bayar
                </th>
                <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                  No. Pembayaran
                </th>
                {isPaidTab && canUpdate && (
                  <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                    Journal
                  </th>
                )}
                {canDelete && <th className="px-2 py-2 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100 dark:divide-gray-700">
              {paymentGroups.map((group) =>
                group.kind === "batch" ? (
                  <BulkPaymentBatchRows
                    key={group.batchId}
                    batchId={group.batchId}
                    payments={group.payments}
                    expanded={expandedBatches.has(group.batchId)}
                    onToggle={() => toggleBatch(group.batchId)}
                    {...rowHandlers}
                  />
                ) : (
                  <PaymentRow
                    key={group.payment.id}
                    payment={group.payment}
                    {...rowHandlers}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const paymentPagination = payPagination && payPagination.total > 0 && (
    <div className="border-t border-rose-200/80 dark:border-gray-700 px-3 py-2">
      <Pagination
        pagination={payPagination}
        onPageChange={setPage}
        onLimitChange={(l) => setLimit(l)}
        currentLength={payments.length}
        loading={payLoading}
      />
    </div>
  );

  return (
    <ApPaymentsShell className="flex flex-col h-full">
      {/* Header */}
      <div className={`${apTheme.header} px-4 sm:px-6 py-4`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={apTheme.headerIcon}>
              <Wallet className="w-6 h-6 shrink-0" />
            </div>
            <div className="min-w-0">
              <h1
                className={`text-lg sm:text-xl font-bold truncate ${apTheme.title}`}
              >
                AP Payments
              </h1>
              <p className={`text-xs sm:text-sm ${apTheme.subtitle}`}>
                Pembayaran hutang dagang
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link to={AP_DASHBOARD_PATH} className={apTheme.btnSecondary}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
            <Link
              to="/finance/ap-payments/report"
              className={apTheme.btnSecondary}
            >
              <FileSpreadsheet className="w-4 h-4" /> Report
            </Link>
            <button
              type="button"
              onClick={() => setShowVerify(true)}
              className={apTheme.btnSecondary}
            >
              <ShieldCheck className="w-4 h-4" /> Verifikasi BCA
            </button>
          </div>
        </div>
      </div>

      {/* Global Filters */}
      <div className={`${apTheme.header} px-4 sm:px-6 py-3`}>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari invoice / pembayaran..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={apTheme.inputSearch}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={filters.supplierId}
            onChange={(e) => setFilters({ supplierId: e.target.value })}
            className={apTheme.select}
          >
            <option value="">Semua supplier</option>
            {(suppliersData?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.supplier_name}
              </option>
            ))}
          </select>
          <select
            value={filters.branchId}
            onChange={(e) => setFilters({ branchId: e.target.value })}
            className={apTheme.select}
          >
            <option value="">Semua cabang</option>
            {(branchesData?.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Split Panels */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* ── Desktop: resizable side-by-side ── */}
        <div
          ref={containerRef}
          className="hidden lg:flex h-full gap-0 rounded-xl overflow-hidden border border-rose-200/80 dark:border-gray-700"
          style={{ minHeight: 500 }}
        >
          {/* ═══ LEFT PANEL: Invoice Outstanding ═══ */}
          <div
            className={`${apTheme.card} flex flex-col overflow-hidden rounded-none border-0`}
            style={{ width: `${splitPct}%`, minWidth: 0, flexShrink: 0 }}
          >
            <div className="px-4 py-3 border-b border-rose-200/80 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Invoice Outstanding
              </h2>
              {outstandingPanelFilters}
            </div>
            <div className="flex-1 overflow-auto">
              <OutstandingInvoicesTab filters={outstandingFilters} />
            </div>
          </div>

          {/* ═══ DRAG HANDLE ═══ */}
          <div
            role="separator"
            aria-label="Geser untuk resize panel"
            aria-orientation="vertical"
            className="
              shrink-0 w-2 flex items-center justify-center
              bg-rose-50 dark:bg-gray-800
              border-x border-rose-200/80 dark:border-gray-700
              cursor-col-resize select-none
              transition-colors
              hover:bg-rose-100 dark:hover:bg-gray-700
              active:bg-rose-200 dark:active:bg-gray-600
              group
            "
            onMouseDown={handleDragStart}
            onDoubleClick={handleDragDoubleClick}
            title="Geser untuk resize · Klik dua kali untuk reset"
          >
            <GripVertical className="w-3 h-3 text-rose-300 dark:text-gray-500 group-hover:text-rose-500 dark:group-hover:text-gray-400 transition-colors" />
          </div>

          {/* ═══ RIGHT PANEL: Pembayaran ═══ */}
          <div
            className={`${apTheme.card} flex flex-col overflow-hidden rounded-none border-0 flex-1 min-w-0`}
          >
            <div className="px-4 py-3 border-b border-rose-200/80 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Pembayaran
                </h2>
              </div>
              {paymentPanelFilters}
            </div>
            <div className="flex-1 overflow-auto">{paymentTable}</div>
            {paymentPagination}
          </div>
        </div>

        {/* ── Mobile/tablet: stacked layout (< lg) ── */}
        <div className="flex lg:hidden flex-col gap-4">
          {/* LEFT PANEL */}
          <div
            className={`${apTheme.card} flex flex-col min-h-[400px] overflow-hidden`}
          >
            <div className="px-4 py-3 border-b border-rose-200/80 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Invoice Outstanding
              </h2>
              {outstandingPanelFilters}
            </div>
            <div className="flex-1 overflow-auto">
              <OutstandingInvoicesTab filters={outstandingFilters} />
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div
            className={`${apTheme.card} flex flex-col min-h-[400px] overflow-hidden`}
          >
            <div className="px-4 py-3 border-b border-rose-200/80 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Pembayaran
              </h2>
              {paymentPanelFilters}
            </div>
            <div className="flex-1 overflow-auto">{paymentTable}</div>
            {paymentPagination}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus pembayaran?"
        message={
          deleteTarget ? (
            <ApPaymentDeleteConfirmMessage
              paymentNumber={deleteTarget.payment_number}
              invoiceNumbers={deleteInvoiceNumbers}
              invoiceCount={deleteTarget.invoice_count}
              isLoadingDetails={isDeleteDetailLoading}
            />
          ) : (
            ""
          )
        }
        confirmText="Hapus"
        variant="danger"
        isLoading={deletePayment.isPending}
      />
      {showVerify && (
        <VerifyScreenshotModal onClose={() => setShowVerify(false)} />
      )}
    </ApPaymentsShell>
  );
}
