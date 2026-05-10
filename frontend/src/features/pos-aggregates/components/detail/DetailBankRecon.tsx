import React from "react";
import { Building2, Calendar, Clock, User, Info } from "lucide-react";
import type { AggregatedTransactionWithDetails } from "../../types";
import { formatCurrency, formatDate, type ReconciliationType, TraceableId } from "./shared";

interface Props {
  transaction: AggregatedTransactionWithDetails;
  reconciliationType: ReconciliationType;
}

export const DetailBankRecon: React.FC<Props> = ({ transaction, reconciliationType }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
      <Building2 className="w-3.5 h-3.5 text-cyan-500" />
      Bank Reconciliation
      {reconciliationType !== 'none' && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
          reconciliationType === 'single'
            ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400'
            : reconciliationType === 'settlement'
            ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
            : reconciliationType === 'cash-deposit'
            ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
        }`}>
          {reconciliationType === 'single' ? '1:1 Match'
            : reconciliationType === 'settlement' ? 'Settlement'
            : reconciliationType === 'cash-deposit' ? 'Cash Deposit'
            : 'Multi-Match'}
        </span>
      )}
    </h4>

    {/* SINGLE MATCH */}
    {reconciliationType === 'single' && (
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Bank Name</label>
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{transaction.bank_name || "-"}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Account Name</label>
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{transaction.bank_account_name || "-"}</div>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Account Number</label>
          <TraceableId value={transaction.bank_account_number || "-"} label="Bank Account" context="Bank settlement" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Bank Mutation ID</label>
          <TraceableId value={transaction.bank_mutation_id || "-"} label="Mutation ID" context="Bank statement ref" />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Mutation Date</label>
            <div className="text-[11px] text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" />
              {transaction.bank_mutation_date ? formatDate(transaction.bank_mutation_date) : "-"}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Reconciled Date</label>
            <div className="text-[11px] text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-400" />
              {transaction.reconciled_at ? formatDate(transaction.reconciled_at) : "-"}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Reconciled By</label>
            <div className="text-[11px] text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <User className="w-3 h-3 text-gray-400" />
              {transaction.reconciled_by || "-"}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* SETTLEMENT GROUP */}
    {reconciliationType === 'settlement' && (
      <div className="space-y-2.5">
        <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800 rounded p-2 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-violet-700 dark:text-violet-300">
            Direkonsiliasi melalui settlement group — 1 mutasi bank mencakup beberapa POS aggregate.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Settlement Number</label>
            <div className="text-xs font-medium font-mono text-gray-800 dark:text-gray-200">{transaction.settlement_number || "-"}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Bank Name</label>
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{transaction.settlement_bank_name || transaction.bank_name || "-"}</div>
          </div>
        </div>
        {transaction.settlement_bank_statement_description && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Bank Statement Description</label>
            <div className="text-xs text-gray-700 dark:text-gray-300">{transaction.settlement_bank_statement_description}</div>
          </div>
        )}
        {transaction.settlement_bank_statement_amount != null && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Bank Statement Amount (Total)</label>
            <div className="text-sm font-bold text-gray-800 dark:text-gray-200">{formatCurrency(transaction.settlement_bank_statement_amount)}</div>
            <div className="text-[10px] text-gray-400">Mencakup beberapa POS aggregate dalam 1 settlement</div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Settlement Date</label>
            <div className="text-[11px] text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" />
              {transaction.settlement_date ? formatDate(transaction.settlement_date) : "-"}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Status</label>
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
              transaction.settlement_status === 'RECONCILED'
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
            }`}>
              {transaction.settlement_status || "-"}
            </span>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Reconciled By</label>
            <div className="text-[11px] text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <User className="w-3 h-3 text-gray-400" />
              {transaction.reconciled_by || "-"}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* MULTI-MATCH */}
    {reconciliationType === 'multi-match' && (
      <div className="space-y-2.5">
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded p-2 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            Direkonsiliasi dengan beberapa mutasi bank — 1 POS aggregate dicocokkan ke {transaction.multi_match_statements?.length || 'beberapa'} bank statement.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Total Bank Amount</label>
            <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {transaction.multi_match_total_bank_amount != null ? formatCurrency(transaction.multi_match_total_bank_amount) : "-"}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Difference</label>
            <div className={`text-sm font-bold ${
              transaction.multi_match_difference === 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {transaction.multi_match_difference != null
                ? (transaction.multi_match_difference === 0 ? 'Match ✓' : formatCurrency(Math.abs(transaction.multi_match_difference)))
                : "-"}
            </div>
          </div>
        </div>
        {transaction.multi_match_statements && transaction.multi_match_statements.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
            <div className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Matched Statements ({transaction.multi_match_statements.length})</label>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {transaction.multi_match_statements.map((stmt, idx) => (
                <div key={stmt.id || idx} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-gray-700 dark:text-gray-300 truncate">{stmt.description || '-'}</div>
                    <div className="text-[10px] text-gray-400">{stmt.transaction_date ? formatDate(stmt.transaction_date) : '-'}</div>
                  </div>
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200 shrink-0">{formatCurrency(stmt.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Status</label>
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
              transaction.multi_match_status === 'RECONCILED'
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
            }`}>
              {transaction.multi_match_status || "-"}
            </span>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Reconciled By</label>
            <div className="text-[11px] text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <User className="w-3 h-3 text-gray-400" />
              {transaction.reconciled_by || "-"}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* CASH DEPOSIT */}
    {reconciliationType === 'cash-deposit' && (
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded p-2.5">
            <span className="text-[10px] font-bold text-teal-600 uppercase">Cash Deposit</span>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Tanggal Setor</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{transaction.cash_deposit_date || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cabang</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{transaction.cash_deposit_branch_name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Jumlah</span>
                <span className="font-bold text-teal-700 dark:text-teal-300">
                  {transaction.cash_deposit_amount != null ? `Rp ${Number(transaction.cash_deposit_amount).toLocaleString('id-ID')}` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{transaction.cash_deposit_status || '-'}</span>
              </div>
              {transaction.cash_deposit_proof_url && (
                <div className="pt-1.5 border-t border-teal-200 dark:border-teal-700">
                  <a href={transaction.cash_deposit_proof_url} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-teal-600 hover:underline">Lihat Bukti Setoran →</a>
                </div>
              )}
            </div>
          </div>
          <div className="bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800 rounded p-2.5">
            <span className="text-[10px] font-bold text-cyan-600 uppercase">Bank Statement</span>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Tanggal</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{transaction.cash_deposit_bank_statement_date || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Deskripsi</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 text-right max-w-[120px] truncate">
                  {transaction.cash_deposit_bank_statement_description || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-cyan-700 dark:text-cyan-300">
                  {transaction.cash_deposit_bank_statement_amount != null ? `Rp ${Number(transaction.cash_deposit_bank_statement_amount).toLocaleString('id-ID')}` : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
        {transaction.cash_deposit_amount != null && transaction.cash_deposit_bank_statement_amount != null && (
          <div className="flex justify-between items-center text-xs px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            <span className="text-gray-500">Selisih:</span>
            <span className={`font-bold ${
              Math.abs(transaction.cash_deposit_bank_statement_amount - transaction.cash_deposit_amount) < 1
                ? 'text-green-600' : 'text-amber-600'
            }`}>
              Rp {(transaction.cash_deposit_bank_statement_amount - transaction.cash_deposit_amount).toLocaleString('id-ID')}
            </span>
          </div>
        )}
      </div>
    )}

    {/* NOT RECONCILED */}
    {reconciliationType === 'none' && (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Clock className="w-5 h-5 text-gray-400 mb-1" />
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Reconciliation Pending</div>
        <div className="text-[10px] text-gray-400 mt-0.5">Awaiting bank mutation matching</div>
      </div>
    )}
  </div>
);
