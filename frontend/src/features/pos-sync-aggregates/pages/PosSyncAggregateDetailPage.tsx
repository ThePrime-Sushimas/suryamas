import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  Building2,
  Loader2,
} from "lucide-react";
import { posSyncAggregatesApi } from "../api/pos-sync-aggregates.api";
import { BankMutationSelectorModal } from "@/features/pos-aggregates/components/BankMutationSelectorModal";
import { useToast } from "@/contexts/ToastContext";
import type {
  PosSyncAggregate,
  PosSyncAggregateLine,
} from "../types/pos-sync-aggregates.types";
import type { AggregatedTransactionListItem } from "@/features/pos-aggregates/types";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Number(n));

// Adapter: convert PosSyncAggregate ke shape yang BankMutationSelectorModal expect
function toModalAggregate(
  agg: PosSyncAggregate,
): AggregatedTransactionListItem {
  return {
    id: agg.id,
    branch_name: agg.branch_name,
    source_type: "POS_SYNC",
    source_id: agg.id,
    source_ref: `${agg.sales_date} · ${agg.branch_name} · ${agg.payment_methods?.name ?? ""}`,
    transaction_date: agg.sales_date,
    payment_method_id: agg.payment_method_id ?? 0,
    gross_amount: Number(agg.gross_amount),
    discount_amount: Number(agg.discount_amount),
    tax_amount: Number(agg.tax_amount),
    service_charge_amount: 0,
    bill_after_discount: Number(agg.grand_total),
    percentage_fee_amount: Number(agg.percentage_fee_amount),
    fixed_fee_amount: Number(agg.fixed_fee_amount_calc),
    total_fee_amount: Number(agg.total_fee_amount),
    nett_amount: Number(agg.nett_amount),
    actual_nett_amount: Number(agg.nett_amount) - Number(agg.fee_discrepancy ?? 0),
    actual_fee_amount: agg.actual_fee_amount,
    fee_discrepancy: agg.fee_discrepancy,
    fee_discrepancy_note: agg.fee_discrepancy_note,
    currency: "IDR",
    journal_id: agg.journal_id,
    is_reconciled: agg.is_reconciled,
    status: "READY",
    created_at: agg.created_at,
    updated_at: agg.updated_at,
    deleted_at: null,
    deleted_by: null,
    version: 1,
    payment_method_name: agg.payment_methods?.name,
  };
}

export default function PosSyncAggregateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [aggregate, setAggregate] = useState<PosSyncAggregate | null>(null);
  const [lines, setLines] = useState<PosSyncAggregateLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMutationSelector, setShowMutationSelector] = useState(false);
  const [isMatching, setIsMatching] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [agg, ln] = await Promise.all([
        posSyncAggregatesApi.getById(id),
        posSyncAggregatesApi.getLines(id),
      ]);
      setAggregate(agg);
      setLines(ln);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmMutation = useCallback(
    async (statementId: string) => {
      if (!id) return;
      setIsMatching(true);
      try {
        await posSyncAggregatesApi.reconcile(id, Number(statementId));
        toast.success("Rekonsiliasi berhasil");
        setShowMutationSelector(false);
        await loadData();
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Rekonsiliasi gagal");
      } finally {
        setIsMatching(false);
      }
    },
    [id, loadData, toast],
  );


  if (loading)
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );

  if (!aggregate)
    return (
      <div className="p-6 text-center text-gray-500">Data tidak ditemukan</div>
    );

  const infoRows = [
    ["Tanggal", aggregate.sales_date],
    ["Cabang", aggregate.branch_name ?? `POS #${aggregate.branch_pos_id}`],
    [
      "Payment Method",
      aggregate.payment_methods?.name ?? `POS #${aggregate.payment_pos_id}`,
    ],
    ["Payment Type", aggregate.payment_methods?.payment_type ?? "—"],
    ["Status", aggregate.status],
    ["Jumlah Transaksi", aggregate.status === "VOID"
      ? `${aggregate.void_transaction_count ?? 0} (VOID)`
      : aggregate.transaction_count],
    [
      "Recalculated",
      aggregate.recalculated
        ? `Ya (${aggregate.recalculated_count}x)`
        : "Tidak",
    ],
    ["Journal ID", aggregate.journal_id ?? "—"],
    ["Skip Reason", aggregate.skip_reason ?? "—"],
    ["Synced At", new Date(aggregate.synced_at).toLocaleString("id-ID")],
  ];

  const amountRows = [
    ["Gross Amount", aggregate.gross_amount],
    ["Discount", aggregate.discount_amount],
    ["Tax (PPN)", aggregate.tax_amount],
    ["Other Tax", aggregate.other_tax_amount],
    ["Grand Total", aggregate.grand_total],
    ["Payment Amount", aggregate.payment_amount],
  ];

  const feeRows = [
    [`Fee % (${aggregate.fee_percentage}%)`, aggregate.percentage_fee_amount],
    [
      `Fee Fixed (Rp ${fmt(aggregate.fee_fixed_amount)})`,
      aggregate.fixed_fee_amount_calc,
    ],
    ["Total Fee", aggregate.total_fee_amount],
    ["Nett Amount", aggregate.nett_amount],
  ];

  const reconRows = aggregate.is_reconciled
    ? [
        ["Status", "Sudah Direkonsiliasi ✓"],
        ["Bank Statement ID", aggregate.bank_statement_id ?? "—"],
        [
          "Rekonsiliasi Pada",
          aggregate.reconciled_at
            ? new Date(aggregate.reconciled_at).toLocaleString("id-ID")
            : "—",
        ],
        ["Aktual Fee", `Rp ${fmt(aggregate.actual_fee_amount ?? 0)}`],
        [
          "Selisih Fee",
          aggregate.fee_discrepancy != null
            ? aggregate.fee_discrepancy === 0
              ? "✓ Tidak ada selisih"
              : aggregate.fee_discrepancy > 0
                ? `-Rp ${fmt(aggregate.fee_discrepancy)} (bank kurang bayar)`
                : `+Rp ${fmt(Math.abs(aggregate.fee_discrepancy))} (bank lebih bayar)`
            : "—",
        ],
        ["Catatan", aggregate.fee_discrepancy_note ?? "—"],
      ]
    : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft size={18} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Detail Aggregate
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {aggregate.sales_date} · {aggregate.branch_name} ·{" "}
            {aggregate.payment_methods?.name}
          </p>
        </div>
        {aggregate.recalculated && aggregate.recalculated_count > 1 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-300 px-2 py-1 rounded">
            <AlertTriangle size={12} />
            Recalculated {aggregate.recalculated_count}x
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Info */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Informasi
          </h2>
          <dl className="space-y-2">
            {infoRows.map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <dt className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  {label}
                </dt>
                <dd className="text-xs text-gray-900 dark:text-white text-right font-medium">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Amounts */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Amounts
          </h2>
          <dl className="space-y-2">
            {amountRows.map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  {label}
                </dt>
                <dd className="text-xs text-gray-900 dark:text-white font-medium">
                  Rp {fmt(value as number)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Fee */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Fee & Nett
          </h2>
          <dl className="space-y-2">
            {feeRows.map(([label, value], i) => (
              <div
                key={label as string}
                className={`flex justify-between gap-2 ${i === feeRows.length - 1 ? "pt-2 border-t dark:border-gray-600 mt-2" : ""}`}
              >
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  {label}
                </dt>
                <dd
                  className={`text-xs font-medium ${i === feeRows.length - 1 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}
                >
                  Rp {fmt(value as number)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Reconciliation card */}
      {reconRows && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h2 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">
            Rekonsiliasi Bank
          </h2>
          <dl className="space-y-2">
            {reconRows.map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <dt className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  {label}
                </dt>
                <dd className="text-xs text-gray-900 dark:text-white text-right font-medium">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Lines */}
      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-gray-700">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Detail Transaksi ({lines.length} bills)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {[
                  "Sales Num",
                  "Subtotal",
                  "Discount",
                  "Tax",
                  "Grand Total",
                  "Payment",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {lines.map((line) => (
                <tr
                  key={line.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <td className="px-3 py-2 text-sm font-mono text-gray-900 dark:text-white">
                    {line.sales_num}
                  </td>
                  <td className="px-3 py-2 text-sm text-right text-gray-700 dark:text-gray-300">
                    Rp {fmt(line.subtotal)}
                  </td>
                  <td className="px-3 py-2 text-sm text-right text-gray-700 dark:text-gray-300">
                    {Number(line.discount_total) > 0
                      ? `Rp ${fmt(line.discount_total)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-sm text-right text-gray-700 dark:text-gray-300">
                    Rp {fmt(line.vat_total)}
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                    Rp {fmt(line.grand_total)}
                  </td>
                  <td className="px-3 py-2 text-sm text-right text-green-600 dark:text-green-400">
                    Rp {fmt(line.payment_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700">
              <tr>
                <td className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  TOTAL
                </td>
                <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                  Rp {fmt(lines.reduce((s, l) => s + Number(l.subtotal), 0))}
                </td>
                <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                  Rp{" "}
                  {fmt(lines.reduce((s, l) => s + Number(l.discount_total), 0))}
                </td>
                <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                  Rp {fmt(lines.reduce((s, l) => s + Number(l.vat_total), 0))}
                </td>
                <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                  Rp {fmt(lines.reduce((s, l) => s + Number(l.grand_total), 0))}
                </td>
                <td className="px-3 py-2 text-sm text-right font-medium text-green-600 dark:text-green-400">
                  Rp{" "}
                  {fmt(lines.reduce((s, l) => s + Number(l.payment_amount), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {aggregate.is_reconciled ? (
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                ✓ Sudah direkonsiliasi
              </span>
            ) : (
              <span>Belum direkonsiliasi</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Reconcile button — undo hanya bisa dari halaman Bank Reconciliation */}
            {!aggregate.is_reconciled && aggregate.status !== "PENDING" && (
              <button
                onClick={() => setShowMutationSelector(true)}
                className="px-3 py-2 text-sm text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-2"
              >
                <Building2 size={14} />
                Pilih Mutasi Bank
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bank Mutation Selector Modal */}
      <BankMutationSelectorModal
        isOpen={showMutationSelector}
        onClose={() => setShowMutationSelector(false)}
        onConfirm={handleConfirmMutation}
        aggregate={toModalAggregate(aggregate)}
        isLoading={isMatching}
      />
    </div>
  );
}
