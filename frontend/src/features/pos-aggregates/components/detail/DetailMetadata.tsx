import React from "react";
import {
  FileText,
  Building,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { AggregatedTransactionWithDetails } from "../../types";
import { getStatusColor, getStatusIcon, TraceableId } from "./shared";

interface Props {
  transaction: AggregatedTransactionWithDetails;
}

export const DetailMetadata: React.FC<Props> = ({ transaction }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
    {/* Basic Info */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-blue-500" />
        Informasi Dasar
      </h4>
      <div className="space-y-2.5">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Referensi Transaksi</label>
          <TraceableId value={transaction.source_ref} label="Referensi" context="Source: POS System" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Tipe</label>
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{transaction.source_type}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Versi</label>
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200">v{transaction.version}</div>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">ID Sumber</label>
          <TraceableId value={transaction.source_id} label="ID Sumber" context="Internal tracking" />
        </div>
      </div>
    </div>

    {/* Branch & Payment */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
        <Building className="w-3.5 h-3.5 text-green-500" />
        Lokasi & Pembayaran
      </h4>
      <div className="space-y-2.5">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Cabang</label>
          <div className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200">
            <Building className="w-3 h-3 text-gray-400" />
            <span className="font-medium">{transaction.branch_name || "Tidak tersedia"}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Metode Pembayaran</label>
          <div className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200">
            <CreditCard className="w-3 h-3 text-gray-400" />
            <span className="font-medium">{transaction.payment_method_name || `ID: ${transaction.payment_method_id}`}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Status Rekonsiliasi</label>
          {transaction.is_reconciled ? (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-medium">Reconciled</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-medium">Pending</span>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Status */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
        Status Transaksi
      </h4>
      <div className="space-y-2.5">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Status Saat Ini</label>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getStatusColor(transaction.status)}`}>
            {getStatusIcon(transaction.status)}
            {transaction.status}
          </span>
        </div>
        {transaction.status === "FAILED" && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded p-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <label className="text-[10px] font-semibold text-red-600 uppercase">Alasan Kegagalan</label>
                <div className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                  {transaction.failed_reason || "Tidak diketahui"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
