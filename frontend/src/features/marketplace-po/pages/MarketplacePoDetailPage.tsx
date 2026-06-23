import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import {
  useMarketplaceSession,
  useOrderSession,
  useSettleSession,
  useMarketplaceSessionGrs,
  useRemoveSessionLine,
  useCancelSessionLine,
} from "../api/marketplacePo.api";
import {
  SessionStatusBadge,
  PlatformBadge,
} from "../components/SessionStatusBadge";
import { SessionTimeline } from "../components/SessionTimeline";
import { SessionItemsTab } from "../components/SessionItemsTab";
import { SessionShipmentsTab } from "../components/SessionShipmentsTab";
import { SessionAttachmentsTab } from "../components/SessionAttachmentsTab";
import { SessionJournalTab } from "../components/SessionJournalTab";
import { OrderConfirmModal } from "../components/OrderConfirmModal";
import { SettleModal } from "../components/SettleModal";
import { fmtCurrency, fmtDate } from "../utils/format";
import { PLATFORM_CONFIG } from "../utils/constants";
import type { MarketplaceSessionStatus } from "../types/marketplacePo.types";
import {
  useCancelOrderedSession,
  useCancelShippedSession,
} from "../api/marketplacePo.api";
import { CancelSessionModal } from "../components/CancelSessionModal";
import { CancelLineModal } from "../components/CancelLineModal";

type TabId = "items" | "shipments" | "attachments" | "journal";

const TABS: { id: TabId; label: string }[] = [
  { id: "items", label: "Item" },
  { id: "attachments", label: "Lampiran" },
  { id: "shipments", label: "Resi" },
  { id: "journal", label: "Journal" },
];

export default function MarketplacePoDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canUpdate = hasPermission("marketplace_po", "update");
  const canRelease = hasPermission("marketplace_po", "release");

  const [activeTab, setActiveTab] = useState<TabId>("items");
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  const { data, isLoading } = useMarketplaceSession(id);
  const orderSession = useOrderSession();
  const settleSession = useSettleSession();

  const header = data?.header;
  const lines = data?.lines ?? [];
  const shipments = data?.shipments ?? [];
  const attachments = data?.attachments ?? [];

  const { data: sessionGrs = [] } = useMarketplaceSessionGrs(
    header?.session_number ?? "",
    header?.status === "SHIPPED" || header?.status === "RECEIVED",
  );

  const branchCount = useMemo(
    () => new Set(lines.map((l) => l.branch_id)).size,
    [lines],
  );
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLineTarget, setCancelLineTarget] = useState<{
    id: string;
    productName: string;
  } | null>(null);
  const cancelOrdered = useCancelOrderedSession();
  const cancelShipped = useCancelShippedSession();
  const removeLineMutation = useRemoveSessionLine();
  const cancelLineMutation = useCancelSessionLine();

  const handleCancel = async (payload: {
    cancel_reason: string;
    platform_cancel_ref?: string;
  }) => {
    if (!header) return;
    try {
      if (header.status === "ORDERED") {
        await cancelOrdered.mutateAsync({ id: header.id, ...payload });
      } else {
        await cancelShipped.mutateAsync({ id: header.id, ...payload });
      }
      toast.success("Pesanan berhasil dibatalkan");
      setShowCancelModal(false);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal membatalkan pesanan"));
    }
  };

  const isCancelPending = cancelOrdered.isPending || cancelShipped.isPending;

  const handleRemoveLine = async (lineId: string) => {
    if (!header) return;
    try {
      await removeLineMutation.mutateAsync({ sessionId: header.id, lineId });
      toast.success("Item berhasil dihapus dari session");
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal menghapus item"));
    }
  };

  const handleCancelLine = async (cancelReason: string) => {
    if (!header || !cancelLineTarget) return;
    try {
      await cancelLineMutation.mutateAsync({
        sessionId: header.id,
        lineId: cancelLineTarget.id,
        cancelReason,
      });
      toast.success("Item berhasil dibatalkan dan jurnal koreksi sudah dibuat");
      setCancelLineTarget(null);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal membatalkan item"));
    }
  };

  const ccDisplay = useMemo(() => {
    if (!header) return "-";
    const label = header.card_label ?? header.cc_label ?? "";
    const last4 = header.last4;
    return last4 ? `${label} · ${last4}` : label || "-";
  }, [header]);

  const handleOrder = async () => {
    if (!header) return;
    try {
      await orderSession.mutateAsync({ id: header.id });
      toast.success("Order berhasil dikonfirmasi");
      setShowOrderModal(false);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal konfirmasi order"));
    }
  };

  const handleSettle = async (payload: {
    bank_account_id: number;
    amount: number;
    reference_number: string;
    settled_date: string;
    notes?: string | null;
  }) => {
    if (!header) return;
    try {
      await settleSession.mutateAsync({ id: header.id, ...payload });
      toast.success("Pelunasan CC berhasil");
      setShowSettleModal(false);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal pelunasan"));
    }
  };

  const actionButton = useMemo(() => {
    if (!header || !canUpdate) return null;
    const map: Record<
      MarketplaceSessionStatus,
      { label: string; onClick: () => void; className: string } | null
    > = {
      DRAFT: {
        label: "Konfirmasi Order",
        onClick: () => setShowOrderModal(true),
        className: "bg-teal-600 hover:bg-teal-700",
      },
      ORDERED: {
        label: "Input Resi & Kirim",
        onClick: () => setActiveTab("shipments"),
        className: "bg-blue-600 hover:bg-blue-700",
      },
      SHIPPED: null,
      RECEIVED: canRelease ? {
        label: "Pelunasan Marketplace",
        onClick: () => setShowSettleModal(true),
        className: "bg-purple-600 hover:bg-purple-700",
      } : null,
      SETTLED: null,
      CANCELLED: null,
    };
    return map[header.status];
  }, [header, canUpdate, canRelease]);

  const showCancelButton =
    canRelease &&
    (header?.status === "ORDERED" || header?.status === "SHIPPED");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-6 space-y-4">
        <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
        <div className="h-96 bg-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!header) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Session tidak ditemukan</p>
        <button
          type="button"
          onClick={() => navigate("/inventory/marketplace-po")}
          className="mt-4 text-teal-600 text-sm"
        >
          Kembali ke daftar
        </button>
      </div>
    );
  }

  const platformCfg = PLATFORM_CONFIG[header.platform];

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 pb-8">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200/60 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate("/inventory/marketplace-po")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white font-mono">
                  {header.session_number}
                </h1>
                <SessionStatusBadge status={header.status} />
              </div>
              <p className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-1">
                <span className={platformCfg.textColor}>
                  {platformCfg.label}
                </span>
                <span>·</span>
                <span>{ccDisplay}</span>
                <span>·</span>
                <span>{fmtDate(header.checkout_date)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showCancelButton && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 text-sm text-red-600 border border-red-300 hover:bg-red-50 rounded-xl font-medium"
              >
                Batalkan Pesanan
              </button>
            )}
            {actionButton && (
              <button
                type="button"
                onClick={actionButton.onClick}
                className={`px-4 py-2 text-sm text-white rounded-xl font-medium ${actionButton.className}`}
              >
                {actionButton.label}
              </button>
            )}
          </div>
        </div>
        <CancelSessionModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancel}
          isLoading={isCancelPending}
          status={header.status}
        />
      </div>

      <div className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6">
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700 shadow-sm p-4">
          <SessionTimeline status={header.status} />
        </section>

        {header.status === "SHIPPED" && sessionGrs.length > 0 && (
          <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
              📦 Barang sedang dalam pengiriman
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
              Saat paket per toko tiba, buka GR di bawah lalu{" "}
              <span className="font-semibold">Konfirmasi Penerimaan</span> (tanpa
              edit). Qty aktual ditimbang di Barang Masuk (GP).
            </p>
            <div className="flex flex-col gap-2">
              {sessionGrs.map((gr) => (
                <Link
                  key={gr.id}
                  to={`/inventory/goods-receipts/${gr.id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-xl text-sm font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  <ExternalLink className="w-4 h-4" />
                  {gr.gr_number} — Konfirmasi di sini
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <InfoCard
            label="Total"
            value={fmtCurrency(header.total_amount)}
            highlight
          />
          <InfoCard
            label="Platform"
            value={<PlatformBadge platform={header.platform} />}
          />
          <InfoCard label="Kartu Kredit" value={ccDisplay} />
          <InfoCard label="Tanggal" value={fmtDate(header.checkout_date)} />
          <InfoCard
            label="Goods Receipt"
            value={
              sessionGrs.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {sessionGrs.map((gr) => (
                    <Link
                      key={gr.id}
                      to={`/inventory/goods-receipts/${gr.id}`}
                      className="inline-flex items-center gap-1 text-teal-600 hover:underline text-sm"
                    >
                      {gr.gr_number} <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  ))}
                </div>
              ) : header?.goods_receipt_id ? (
                <Link
                  to={`/inventory/goods-receipts/${header.goods_receipt_id}`}
                  className="inline-flex items-center gap-1 text-teal-600 hover:underline text-sm"
                >
                  Lihat GR <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="text-gray-400 text-sm">—</span>
              )
            }
          />
          <InfoCard
            label="Goods Processing"
            value={
              header.gp_id ? (
                <Link
                  to={`/inventory/goods-processing/${header.gp_id}`}
                  className="inline-flex items-center gap-1 hover:underline text-sm"
                >
                  <GpStatusBadge status={header.gp_status} />
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </Link>
              ) : (
                <span className="text-gray-400 text-sm">—</span>
              )
            }
          />
        </section>
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-teal-600 text-teal-700 dark:text-teal-400"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-4 lg:p-6">
            {activeTab === "items" && (
              <SessionItemsTab
                lines={lines}
                sessionStatus={header.status}
                canUpdate={canUpdate}
                onRemoveLine={handleRemoveLine}
                onCancelLine={setCancelLineTarget}
                isRemovePending={removeLineMutation.isPending}
              />
            )}
            {activeTab === "shipments" && (
              <SessionShipmentsTab
                sessionId={header.id}
                status={header.status}
                lines={lines}
                shipments={shipments}
              />
            )}
            {activeTab === "attachments" && (
              <SessionAttachmentsTab
                sessionId={header.id}
                status={header.status}
                attachments={attachments}
              />
            )}
            {activeTab === "journal" && <SessionJournalTab header={header} />}
          </div>
        </section>
      </div>

      <OrderConfirmModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        onConfirm={handleOrder}
        isLoading={orderSession.isPending}
        session={header}
        attachments={attachments}
        lineCount={lines.length}
        branchCount={branchCount}
      />
      <SettleModal
        isOpen={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        onConfirm={handleSettle}
        isLoading={settleSession.isPending}
        session={header}
      />
      <CancelLineModal
        isOpen={!!cancelLineTarget}
        productName={cancelLineTarget?.productName ?? ""}
        onClose={() => setCancelLineTarget(null)}
        onConfirm={handleCancelLine}
        isLoading={cancelLineMutation.isPending}
      />
    </div>
  );
}

function InfoCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700 p-3 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div
        className={`text-sm ${highlight ? "font-bold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}
      >
        {value}
      </div>
    </div>
  );
}
function GpStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const map: Record<string, { label: string; className: string }> = {
    PROCESSING: {
      label: "Processing",
      className: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    },
    CONFIRMED: {
      label: "Selesai",
      className: "text-green-600 bg-green-50 dark:bg-green-900/20",
    },
  };
  const cfg = map[status] ?? {
    label: status,
    className: "text-gray-500 bg-gray-100",
  };
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
