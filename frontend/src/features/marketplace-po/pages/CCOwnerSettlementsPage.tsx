import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import {
  useCCOwnerSettlementSummary,
  useCreateBulkCCOwnerSettlement,
  usePendingMarketplaceSessions,
} from "../api/marketplacePo.api";
import { SettleModal } from "../components/SettleModal";
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
  const createBulkSettlement = useCreateBulkCCOwnerSettlement();

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);

  // Guard: Redirect if no permission
  if (!canView) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Kamu tidak memiliki akses ke halaman ini</p>
      </div>
    );
  }

  const isLoading = summaryLoading || pendingLoading;

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
    if (selectedSessions.length === 0) {
      toast.error("Pilih minimal satu sesi untuk dilunasi");
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
    if (pendingSessions && selectedSessions.length === pendingSessions.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(pendingSessions?.map((s: MarketplaceCheckoutSession) => s.id) || []);
    }
  };

  const selectedTotal = (pendingSessions || [])
    .filter((s: MarketplaceCheckoutSession) => selectedSessions.includes(s.id))
    .reduce((sum: number, s: MarketplaceCheckoutSession) => sum + s.total_amount, 0);

  const mockSessionForModal: MarketplaceCheckoutSession = {
    id: "bulk",
    company_id: "",
    session_number: `BULK_${selectedSessions.length}_sessions`,
    platform: "SHOPEE",
    cc_id: "",
    cc_label: "Multiple CC",
    checkout_date: new Date().toISOString(),
    total_amount: selectedTotal,
    card_label: "Multiple CC",
    notes: null,
    status: "RECEIVED",
    platform_order_ids: null,
    platform_receipt_url: null,
    journal_ordered_id: null,
    journal_received_id: null,
    journal_settled_id: null,
    goods_receipt_id: null,
    gp_id: null,
    gp_status: null,
    gp_number: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

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
                Pelunasan CC Owner
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Kelola semua pelunasan hutang ke pemilik kartu kredit
              </p>
            </div>
          </div>
          <button
            onClick={handleBulkSettle}
            disabled={selectedSessions.length === 0 || createBulkSettlement.isPending || !canUpdateSettle}
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
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Sesi Belum Lunas</h2>
            <button
              onClick={selectAllPending}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              {selectedSessions.length === pendingSessions?.length ? "Batal Pilih Semua" : "Pilih Semua"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-12"></th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Nomor Sesi</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">CC</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Tanggal</th>
                  <th className="text-right p-3 text-xs font-medium text-gray-500 dark:text-gray-400">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {(pendingSessions || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      Semua sesi sudah lunas
                    </td>
                  </tr>
                ) : (
                  (pendingSessions || []).map((session: MarketplaceCheckoutSession) => (
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
      <SettleModal
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        onConfirm={async (data) => {
          try {
            await createBulkSettlement.mutateAsync({
              ...data,
              session_ids: selectedSessions,
            });
            toast.success("Pelunasan berhasil dicatat");
            setSelectedSessions([]);
            setShowSettleModal(false);
          } catch (err) {
            toast.error(parseApiError(err, "Gagal mencatat pelunasan"));
          }
        }}
        isLoading={createBulkSettlement.isPending}
        session={mockSessionForModal}
      />
    </div>
  );
}