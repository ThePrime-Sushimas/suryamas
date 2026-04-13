import React from "react";
import { useBankVouchersStore } from "../store/bankVouchers.store";
import type { VoucherDay, VoucherLine, DailySummaryItem } from "../types/bank-vouchers.types";

// ============================================
// Format currency IDR
// ============================================
const formatIDR = (amount: number): string => {
  if (amount === 0) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

// ============================================
// Main table component
// ============================================
export const BankVoucherTable = () => {
  const {
    preview,
    summaryData,
    loading,
    expandedDates,
    toggleDate,
    expandAll,
    collapseAll,
    confirmVouchers,
  } = useBankVouchersStore();

  const handleConfirm = async (date: string) => {
    if (
      !window.confirm(
        `Konfirmasi voucher bank untuk tanggal ${formatDate(date)}?`,
      )
    )
      return;
    try {
      await confirmVouchers([date]);
    } catch (error) {
      alert("Gagal konfirmasi voucher. Silakan coba lagi.");
    }
  };

  if (loading.preview) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-10 bg-gray-100 dark:bg-gray-800 rounded w-full"
          />
        ))}
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          Pilih periode dan klik <strong>Tampilkan</strong> untuk melihat buku
          mutasi bank
        </p>
      </div>
    );
  }

  if (preview.vouchers.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          Tidak ada transaksi yang sudah direkonsiliasi untuk periode{" "}
          {preview.period_label}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Expand/Collapse controls */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {preview.vouchers.length} voucher · {preview.summary.total_lines}{" "}
          baris
        </p>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Buka Semua
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
            <tr className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
              <th className="px-3 py-3 text-left w-24">Tanggal</th>
              <th className="px-3 py-3 text-left w-32">Voucher</th>
              <th className="px-3 py-3 text-left">Keterangan / Payment</th>
              <th className="px-3 py-3 text-left">Bank</th>
              <th className="px-3 py-3 text-right">Debit (Masuk)</th>
              <th className="px-3 py-3 text-right">Kredit (Keluar)</th>
              <th className="px-3 py-3 text-right w-40">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {preview.vouchers.map((voucher: VoucherDay) => {
              const isExpanded = expandedDates.has(voucher.transaction_date);
              // Cari running balance untuk tanggal ini dari summaryData
              const dailySummary = summaryData?.by_date.find(
                (d: DailySummaryItem) => d.transaction_date === voucher.transaction_date,
              );
              const runningBalance = dailySummary?.running_balance ?? 0;

              return (
                <React.Fragment key={voucher.transaction_date}>
                  {/* Day header row */}
                  <tr
                    className="group bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all border-l-4 border-l-transparent hover:border-l-blue-500"
                    onClick={() => toggleDate(voucher.transaction_date)}
                  >
                    <td className="px-3 py-4">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatDate(voucher.transaction_date)}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-tight ${
                            voucher.is_confirmed
                              ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                              : "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800"
                          }`}
                        >
                          {voucher.voucher_number}
                        </span>
                        {voucher.is_confirmed && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"
                            title="Confirmed"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                          Mutasi Penjualan Harian
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {voucher.branch_name} •{" "}
                          {voucher.lines.filter((l: VoucherLine) => !l.is_fee_line).length}{" "}
                          payment methods
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Multi-acc
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <span className="text-sm font-bold font-mono text-green-600 dark:text-green-400">
                        {formatIDR(voucher.day_total)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right text-gray-300 dark:text-gray-600 font-mono text-sm">
                      —
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                          {formatIDR(runningBalance)}
                        </span>
                        <span
                          className={`p-1 bg-gray-100 dark:bg-gray-700 rounded transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <svg
                            className="w-3 h-3 text-gray-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Detail Lines */}
                  {isExpanded && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-0 bg-gray-50/50 dark:bg-gray-900/20"
                      >
                        <div className="py-4 space-y-3">
                          <div className="flex items-center justify-between px-2">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              Detail Alokasi Voucher
                            </h4>
                            <div className="flex items-center gap-2">
                              <button
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                                disabled={!voucher.is_confirmed}
                              >
                                Cetak Voucher
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirm(voucher.transaction_date);
                                }}
                                disabled={
                                  voucher.is_confirmed || loading.confirm
                                }
                                className={`text-[10px] font-bold px-2 py-1 rounded transition-all uppercase flex items-center gap-1.5 ${
                                  voucher.is_confirmed
                                    ? "text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-default"
                                    : "text-green-600 hover:text-green-700 bg-green-50 dark:bg-green-900/30 active:scale-95"
                                }`}
                              >
                                {loading.confirm ? (
                                  <div className="w-2.5 h-2.5 border-2 border-green-600/20 border-t-green-600 rounded-full animate-spin" />
                                ) : voucher.is_confirmed ? (
                                  <svg
                                    className="w-3 h-3 text-green-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                ) : null}
                                {voucher.is_confirmed
                                  ? "Confirmed"
                                  : "Konfirmasi BM"}
                              </button>
                            </div>
                          </div>
                          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                            <thead className="text-[9px] text-gray-400 uppercase">
                              <tr>
                                <th className="px-2 py-1 text-left">
                                  Akun Bank
                                </th>
                                <th className="px-2 py-1 text-left">
                                  Keterangan
                                </th>
                                <th className="px-2 py-1 text-right">Gross</th>
                                <th className="px-2 py-1 text-right">PB1</th>
                                <th className="px-2 py-1 text-right">Actual Fee</th>
                                <th className="px-2 py-1 text-right">Nett Aktual</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs">
                              {voucher.lines.map((line: VoucherLine, i: number) => (
                                <tr
                                  key={i}
                                  className="hover:bg-white dark:hover:bg-gray-800 transition-colors"
                                >
                                  <td className="px-2 py-2">
                                    <p className="font-medium text-gray-700 dark:text-gray-300">
                                      {line.bank_account_name}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                      {line.bank_account_number}
                                    </p>
                                  </td>
                                  <td className="px-2 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${line.is_fee_line ? "bg-red-400" : "bg-green-400"}`}
                                      />
                                      <span
                                        className={
                                          line.is_fee_line
                                            ? "text-red-500 font-medium"
                                            : "text-gray-600 dark:text-gray-400"
                                        }
                                      >
                                        {line.description}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono text-gray-500">
                                    {line.is_fee_line
                                      ? "—"
                                      : formatIDR(line.gross_amount)}
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono text-orange-400">
                                    {line.is_fee_line ? "—" : formatIDR(line.tax_amount)}
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono text-red-400">
                                    {line.is_fee_line
                                      ? formatIDR(Math.abs(line.nett_amount))
                                      : "—"}
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono font-bold text-gray-700 dark:text-gray-200">
                                    {line.nett_amount < 0
                                      ? `(${formatIDR(Math.abs(line.nett_amount))})`
                                      : formatIDR(line.nett_amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
            <tr className="font-bold text-gray-900 dark:text-gray-100">
              <td
                colSpan={4}
                className="px-3 py-4 text-right uppercase text-xs tracking-wider text-gray-400"
              >
                Total Periode
              </td>
              <td className="px-3 py-4 text-right font-mono text-green-600 dark:text-green-400 border-l border-gray-100 dark:border-gray-800">
                {formatIDR(
                  preview.summary.total_nett + preview.summary.total_fee,
                )}
              </td>
              <td className="px-3 py-4 text-right font-mono text-red-600 dark:text-red-400">
                ({formatIDR(preview.summary.total_fee)})
              </td>
              <td className="px-3 py-4 text-right font-mono text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20">
                {formatIDR(preview.summary.total_nett)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
