import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { fmtCurrency } from "@/lib/formatters";
import { PI_CHARGE_LABELS } from "../types/purchaseInvoice.status";
import {
  computeChargeLine,
  sanitizeChargeAmountInput,
  parseChargeAmountInput,
  effectiveChargeTaxRate,
} from "../utils/purchaseInvoice.charges";
import type { PIChargeRow } from "../types/purchaseInvoice.types";

interface InvoiceChargeTableEditableProps {
  charges: PIChargeRow[];
  allLinesTaxRateZero: boolean;
  onChargeChange: (index: number, updates: Partial<PIChargeRow>) => void;
  onAddCharge: () => void;
  onRemoveCharge: (index: number) => void;
}

export function InvoiceChargeTableEditable({
  charges,
  allLinesTaxRateZero,
  onChargeChange,
  onAddCharge,
  onRemoveCharge,
}: InvoiceChargeTableEditableProps) {
  return (
    <>
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/30 dark:bg-gray-800/40">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Diskon &amp; biaya lain</h2>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onAddCharge}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Tambah baris
        </Button>
      </div>

      <div className="overflow-x-auto px-2 pb-2">
        {charges.length === 0 ? (
          <p className="text-sm text-gray-400 italic px-3 py-4 text-center">
            Opsional — ongkir, diskon nota, biaya admin, dll.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 dark:text-gray-400 text-[10px] uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Jenis</th>
                <th className="px-3 py-2 text-left">Keterangan</th>
                <th className="px-3 py-2 text-right">Nilai (pra-PPN)</th>
                <th className="px-3 py-2 text-center">PPN %</th>
                <th className="px-3 py-2 text-center max-w-18">DPP</th>
                <th className="px-3 py-2 text-right">Total baris</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {charges.map((c, index) => {
                const amt = parseChargeAmountInput(c.amount);
                const { total } = computeChargeLine(amt, effectiveChargeTaxRate(c));
                return (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <Select
                        value={c.charge_type}
                        onChange={(e) => {
                          const v = e.target.value as PIChargeRow["charge_type"];
                          onChargeChange(index, {
                            charge_type: v,
                            affects_dpp: v !== "DISCOUNT" ? false : c.affects_dpp,
                          });
                        }}
                        className="max-w-[140px] py-1 pl-2 pr-7 text-xs"
                      >
                        {(Object.keys(PI_CHARGE_LABELS) as Array<keyof typeof PI_CHARGE_LABELS>).map((k) => (
                          <option key={k} value={k}>{PI_CHARGE_LABELS[k]}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={c.description}
                        onChange={(e) => onChargeChange(index, { description: e.target.value })}
                        placeholder="Opsional"
                        className="min-w-[120px] py-1 px-2 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={c.amount}
                        onChange={(e) =>
                          onChargeChange(index, { amount: sanitizeChargeAmountInput(e.target.value) })
                        }
                        placeholder={c.charge_type === "DISCOUNT" ? "-50000" : "0"}
                        className="w-28 py-1 px-2 text-right text-xs font-mono"
                      />
                      {c.charge_type === "DISCOUNT" ? (
                        <p className="text-[10px] text-amber-600 mt-0.5">Nilai diskon: tanda minus lalu angka</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Input
                        type="number"
                        value={c.tax_rate}
                        disabled={c.charge_type === "DISCOUNT" && c.affects_dpp}
                        onChange={(e) => onChargeChange(index, { tax_rate: Number(e.target.value) })}
                        className="w-14 py-1 px-1 text-center text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-center align-top">
                      {c.charge_type === "DISCOUNT" ? (
                        <label
                          title={allLinesTaxRateZero ? "PPN baris 0%, opsi DPP tidak berlaku." : undefined}
                          className={`flex flex-col items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400 ${
                            allLinesTaxRateZero ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={allLinesTaxRateZero}
                            checked={c.affects_dpp}
                            onChange={(e) =>
                              onChargeChange(index, {
                                affects_dpp: e.target.checked,
                                tax_rate: e.target.checked ? 0 : c.tax_rate,
                              })
                            }
                            className="rounded border-gray-300"
                          />
                          <span className="max-w-18 leading-tight text-center">Kurangi DPP barang</span>
                        </label>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900 dark:text-white">
                      {fmtCurrency(total)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveCharge(index)}
                        aria-label="Hapus baris"
                        className="p-1.5 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
