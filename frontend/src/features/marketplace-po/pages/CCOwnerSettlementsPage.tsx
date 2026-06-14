import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Filter, X } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import { useBranches } from "@/features/branches/api/branches.api";
import {
  useCCOwnerSettlementSummary,
  useCreateBulkCCOwnerSettlement,
  usePendingMarketplaceSessions,
  usePendingCcOwnerGeneralInvoicePayments,
  useOwnerCreditCards,
} from "../api/marketplacePo.api";
import { BulkSettleModal } from "../components/BulkSettleModal";
import { fmtCurrency, fmtDate } from "../utils/format";
import type { MarketplaceCheckoutSession } from "../types/marketplacePo.types";

export default function CCOwnerSettlementsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canView = hasPermission("cc_owner_settlements", "view");
  const canUpdateSettle = hasPermission("cc_owner_settlements", "update");

  const { data: summary, isLoading: summaryLoading } = useCCOwnerSettlementSummary();
  const { data: pendingSessions, isLoading: pendingLoading } = usePendingMarketplaceSessions();
  const { data: pendingGiPayments = [], isLoading: giLoading } = usePendingCcOwnerGeneralInvoicePayments();
  const createBulkSettlement = useCreateBulkCCOwnerSettlement();

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [selectedGiPayments, setSelectedGiPayments] = useState<string[]>([]);

  // Filters
  const [filterBranch, setFilterBranch] = useState("");
  const [filterCc, setFilterCc] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const { data: branchesData } = useBranches({ limit: 100 });
  const branches = branchesData?.data ?? [];
  const { data: ownerCards } = useOwnerCreditCards({ is_active: true });

  const hasActiveFilters = filterBranch || filterCc || filterDateFrom || filterDateTo;

  const resetFilters = () => {
    setFilterBranch("");
    setFilterCc("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  // Client-side filtering of pending sessions
  const filteredSessions = useMemo(() => {
    let list = pendingSessions ?? [];
    if (filterBranch) list = list.filter((s) => s.branch_id === filterBranch);
    if (filterCc) list = list.filter((s) => s.cc_id === filterCc);
    if (filterDateFrom) list = list.filter((s) => s.checkout_date >= filterDateFrom);
    if (filterDateTo) list = list.filter((s) => s.checkout_date <= filterDateTo);
    return list;
  }, [pendingSessions, filterBranch, filterCc, filterDateFrom, filterDateTo]);

  // Reset selection when filters change (prevent submitting invisible sessions)
  const filterKey = `${filterBranch}|${filterCc}|${filterDateFrom}|${filterDateTo}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setSelectedSessions([]);
  }

  // Guard: Redirect if no permission
  if (!canView) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Kamu tidak memiliki akses ke halaman ini</p>
      </div>
    );
  }

  const isLoading = summaryLoading || pendingLoading || giLoading;

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const handleBulkSettle = () => {
    if (selectedSessions.length === 0 && selectedGiPayments.length === 0) {
      toast.error("Pilih minimal satu sesi atau payment untuk dilunasi");
      return;
    }
    setShowSettleModal(true);
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const selectAllPending = () => {
    if (filteredSessions.length > 0 && selectedSessions.length === filteredSessions.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(filteredSessions.map((s) => s.id));
    }
  };

  const selectedTotal = (pendingSessions || [])
    .filter((s: MarketplaceCheckoutSession) => selectedSessions.includes(s.id))
    .reduce((sum: number, s: MarketplaceCheckoutSession) => sum + s.total_amount, 0)
    + pendingGiPayments
      .filter((p) => selectedGiPayments.includes(p.id))
      .reduce((sum, p) => sum + p.total_amount, 0);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/inventory/marketplace-po")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <CreditCard className="w-6 h-6 text-purple-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                Pelunasan Credit Card
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Kelola semua pelunasan hutang ke pemilik kartu kredit
              </p>
            </div>
          </div>
          <button
            onClick={handleBulkSettle}
            disabled={
              (selectedSessions.length === 0 && selectedGiPayments.length === 0) ||
              createBulkSettlement.isPending ||
              !canUpdateSettle
            }
            className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm whitespace-nowrap"
          >
            {createBulkSettlement.isPending ? "Memproses..." : "+ Pelunasan Bulanan"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Hutang Belum Lunas</p>
          <p className="text-2xl font-bold text-red-600">{fmtCurrency(summary?.total_pending || 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Pelunasan Bulan Ini</p>
          <p className="text-2xl font-bold text-green-600">{fmtCurrency(summary?.total_this_month || 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Jumlah Transaksi Belum Lunas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingSessions?.length || 0}</p>
        </div>
      </div>

      {/* Pending Sessions List */}
      <div className="px-4 sm:px-6 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Sesi Belum Lunas</h2>
              <button
                onClick={selectAllPending}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                {selectedSessions.length === filteredSessions.length && filteredSessions.length > 0 ? "Batal Pilih Semua" : "Pilih Semua"}
              </button>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">Semua Cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branch_name}</option>
                ))}
              </select>
              <select
                value={filterCc}
                onChange={(e) => setFilterCc(e.target.value)}
                className="px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">Semua CC</option>
                {(ownerCards ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.card_label}</option>
                ))}
              </select>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                placeholder="Dari"
                className="px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-700 dark:border-gray-600"
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                placeholder="Sampai"
                className="px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-700 dark:border-gray-600"
              />
              {hasActiveFilters && (
                <button onClick={resetFilters} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-xs text-gray-400 ml-auto">{filteredSessions.length} sesi</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-12"></th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Nomor Sesi</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Cabang</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">CC</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Tanggal</th>
                  <th className="text-right p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      {hasActiveFilters ? "Tidak ada sesi yang cocok dengan filter" : "Semua sesi sudah lunas"}
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session: MarketplaceCheckoutSession) => (
                    <tr
                      key={session.id}
                      className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                        selectedSessions.includes(session.id) ? "bg-purple-50 dark:bg-purple-900/20" : ""
                      }`}
                      onClick={() => toggleSessionSelection(session.id)}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedSessions.includes(session.id)}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="p-3 text-sm text-gray-900 dark:text-white">{session.session_number}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{session.branch_name || "-"}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{session.cc_label || session.card_label || "-"}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{fmtDate(session.checkout_date)}</td>
                      <td className="p-3 text-sm text-right text-gray-900 dark:text-white font-medium">{fmtCurrency(session.total_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pending General Invoice CC_OWNER Payments */}
      {pendingGiPayments.length > 0 && (
        <div className="px-4 sm:px-6 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Tagihan Umum via CC Owner (Belum Lunas)</h2>
                <p className="text-xs text-gray-500 mt-1">General invoice yang dibayar via marketplace — perlu di-settle ke owner</p>
              </div>
              <button
                onClick={() => {
                  if (selectedGiPayments.length === pendingGiPayments.length) {
                    setSelectedGiPayments([]);
                  } else {
                    setSelectedGiPayments(pendingGiPayments.map((p) => p.id));
                  }
                }}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                {selectedGiPayments.length === pendingGiPayments.length ? "Batal Pilih Semua" : "Pilih Semua"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-12"></th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">No. Payment</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Invoice</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Vendor</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">CC</th>
                    <th className="text-right p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingGiPayments.map((pay) => (
                    <tr
                      key={pay.id}
                      className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                        selectedGiPayments.includes(pay.id) ? "bg-purple-50 dark:bg-purple-900/20" : ""
                      }`}
                      onClick={() => {
                        setSelectedGiPayments((prev) =>
                          prev.includes(pay.id)
                            ? prev.filter((id) => id !== pay.id)
                            : [...prev, pay.id]
                        );
                      }}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedGiPayments.includes(pay.id)}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="p-3 text-sm font-mono text-gray-900 dark:text-white">{pay.payment_number}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{pay.invoice_number}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{pay.vendor_name}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{pay.cc_label}</td>
                      <td className="p-3 text-sm text-right text-gray-900 dark:text-white font-medium">{fmtCurrency(pay.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Settlement History */}
      <div className="px-4 sm:px-6 flex-1 overflow-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Histori Pelunasan</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Tanggal</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Referensi</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Bank</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Catatan</th>
                  <th className="text-right p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.history || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      Belum ada histori pelunasan
                    </td>
                  </tr>
                ) : (
                  (summary?.history || []).map((settlement: any) => (
                    <tr key={settlement.id} className="border-b dark:border-gray-700">
                      <td className="p-3 text-sm text-gray-900 dark:text-white">{fmtDate(settlement.settled_date)}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{settlement.reference_number}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{settlement.bank_name}</td>
                      <td className="p-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">{settlement.notes || "-"}</td>
                      <td className="p-3 text-sm text-right text-gray-900 dark:text-white font-medium">{fmtCurrency(settlement.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Settle Modal */}
      <BulkSettleModal
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        onConfirm={async (data) => {
          try {
            await createBulkSettlement.mutateAsync({
              ...data,
              session_ids: selectedSessions,
              general_invoice_payment_ids: selectedGiPayments,
            })
            toast.success('Pelunasan berhasil dicatat')
            setSelectedSessions([])
            setSelectedGiPayments([])
            setShowSettleModal(false)
          } catch (err) {
            toast.error(parseApiError(err, 'Gagal mencatat pelunasan'))
          }
        }}
        isLoading={createBulkSettlement.isPending}
        selectedCount={selectedSessions.length + selectedGiPayments.length}
        selectedTotal={selectedTotal}
        selectedSessions={(pendingSessions ?? []).filter((s) =>
          selectedSessions.includes(s.id),
        )}
      />
    </div>
  );
}