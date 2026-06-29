import { Trash2, Pencil, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type {
  PettyCashExpense,
  PettyCashRequestStatus,
} from "../types/pettyCash.types";
import { fmtCurrency, fmtDate, fmtQty } from "../utils/pettyCash.formatters";

interface PettyCashExpenseTableProps {
  expenses: PettyCashExpense[];
  requestStatus: PettyCashRequestStatus;
  onEdit: (expense: PettyCashExpense) => void;
  onDelete: (expenseId: string) => void;
}

export function PettyCashExpenseTable({
  expenses,
  requestStatus,
  onEdit,
  onDelete,
}: PettyCashExpenseTableProps) {
  const canAct = requestStatus === "DISBURSED";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Pengeluaran ({expenses.length})
        </h3>
      </div>
      {expenses.length === 0 ? (
        <div className="p-5 text-center text-sm text-gray-500">
          Belum ada expense
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Tgl
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Produk / Keterangan
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Kategori
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  Qty / Satuan
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  Harga
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">
                  Total
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">
                  Masuk Inventory
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Gudang
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  Fixed Asset
                </th>
                {canAct && (
                  <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20"
                >
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {fmtDate(e.expense_date)}
                  </td>
                  <td className="px-3 py-2">
                    {e.product_name ? (
                      <div>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {e.product_name}
                        </span>
                        {e.description && (
                          <p className="text-xs text-gray-500 truncate max-w-[180px]">
                            {e.description}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300">
                        {e.description || "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">
                    {e.category_name}
                    {e.sub_category_name ? ` / ${e.sub_category_name}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                    {e.qty != null ? (
                      <span>
                        {fmtQty(e.qty)}{" "}
                        <span className="text-xs text-gray-400">
                          {e.product_uom_name || e.base_unit_name || ""}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmtCurrency(e.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white tabular-nums">
                    {fmtCurrency(e.amount)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {e.warehouse_id ? (
                      <span className="text-green-600 text-xs font-medium">
                        Ya
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-xs">
                    {e.warehouse_name || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {e.fixed_asset_id ? (
                      <Link
                        to={`/fixed-assets/${e.fixed_asset_id}`}
                        className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {e.asset_code || "Aset"}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {canAct && (
                    <td className="px-3 py-2 text-center">
                      {!e.settlement_id && (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEdit(e)}
                            className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-500" />
                          </button>
                          <button
                            onClick={() => onDelete(e.id)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {expenses.length > 1 && (
              <tfoot>
                <tr className="bg-gray-50/50 dark:bg-gray-700/30 font-medium">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-right text-gray-600 dark:text-gray-300"
                  >
                    Total
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-white tabular-nums">
                    {fmtCurrency(
                      expenses.reduce((sum, e) => sum + e.amount, 0),
                    )}
                  </td>
                  <td colSpan={canAct ? 4 : 3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

