import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DateInput } from "@/components/ui/DateInput";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { fmtCurrency } from "../utils/purchaseInvoice.formatters";
import type { PurchaseInvoiceLine } from "../api/purchaseInvoices.api";
import type { SplitNotaDraft } from "../types/purchaseInvoice.types";

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
}

interface SplitNotaCardProps {
  index: number;
  nota: SplitNotaDraft;
  canRemove: boolean;
  allLines: PurchaseInvoiceLine[];
  assignmentMap: Map<string, string>;
  supplierBankAccounts: BankAccount[];
  onRemove: () => void;
  onUpdate: (patch: Partial<SplitNotaDraft>) => void;
  onToggleLine: (grLineId: string) => void;
}

export function SplitNotaCard({
  index,
  nota,
  canRemove,
  allLines,
  assignmentMap,
  supplierBankAccounts,
  onRemove,
  onUpdate,
  onToggleLine,
}: SplitNotaCardProps) {
  const selectedLines = allLines.filter((l) =>
    nota.gr_line_ids.includes(l.gr_line_id),
  );
  const subtotal = selectedLines.reduce((s, l) => s + Number(l.total), 0);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-4">
      {/* Nota header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Nota {index + 1}
        </h3>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={onRemove}
            className="text-red-600 hover:text-red-700"
          >
            Hapus nota
          </Button>
        )}
      </div>

      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <FormField label="No. Invoice Supplier">
          <Input
            type="text"
            value={nota.invoice_number}
            onChange={(e) => onUpdate({ invoice_number: e.target.value })}
            placeholder="INV/SUP/001"
          />
        </FormField>

        <FormField label="Tanggal Invoice">
          <DateInput
            value={nota.invoice_date}
            onChange={(e) => onUpdate({ invoice_date: e.target.value })}
          />
        </FormField>

        {supplierBankAccounts.length > 0 && (
          <div className="sm:col-span-2">
            <FormField label="Rekening Tujuan Supplier">
              <Select
                value={nota.supplier_bank_account_id ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdate({
                    supplier_bank_account_id: v === "" ? null : Number(v),
                  });
                }}
              >
                <option value="">Pilih rekening tujuan...</option>
                {supplierBankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>
                    {ba.bank_name} — {ba.account_number} - {ba.account_name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        )}
      </div>

      {/* Line checkbox table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 w-10" />
              <th className="px-3 py-2 text-left">Barang</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {allLines.map((line) => {
              const assignedElsewhere =
                assignmentMap.get(line.gr_line_id) &&
                assignmentMap.get(line.gr_line_id) !== nota.key;
              const checked = nota.gr_line_ids.includes(line.gr_line_id);

              return (
                <tr
                  key={line.gr_line_id}
                  className={`border-t border-gray-100 dark:border-gray-800 ${
                    assignedElsewhere ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!!assignedElsewhere}
                      onChange={() => onToggleLine(line.gr_line_id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {line.product_name}
                    </div>
                    <div className="text-xs text-gray-500">{line.product_code}</div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {fmtCurrency(Number(line.total))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      <div className="mt-3 flex justify-between text-sm">
        <span className="text-gray-500">{selectedLines.length} item dipilih</span>
        <span className="font-semibold text-gray-900 dark:text-white">
          {fmtCurrency(subtotal)}
        </span>
      </div>
    </div>
  );
}
