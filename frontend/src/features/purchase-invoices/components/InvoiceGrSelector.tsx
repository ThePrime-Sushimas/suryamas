import { CheckCircle2 } from "lucide-react";

interface GrItem {
  id: string;
  gr_number: string;
  received_date: string;
}

interface GrLink {
  goods_receipt_id: string;
  goods_receipt_number: string | null;
  received_date: string;
}

interface InvoiceGrSelectorProps {
  supplierId: string;
  branchId: string;
  isEdit: boolean;
  isFetchingGrs: boolean;
  availableGrs: GrItem[] | undefined;
  selectedGrIds: string[];
  onGrToggle: (grId: string) => void;
  /** Edit mode: existing GR links to show as locked */
  existingGrLinks?: GrLink[];
}

export function InvoiceGrSelector({
  supplierId,
  branchId,
  isEdit,
  isFetchingGrs,
  availableGrs,
  selectedGrIds,
  onGrToggle,
  existingGrLinks,
}: InvoiceGrSelectorProps) {
  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
      <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        Pilih Penerimaan Barang (GR)
      </h2>

      {!supplierId || !branchId ? (
        <div className="text-center py-8 text-gray-400 text-sm italic">
          Pilih supplier dan cabang terlebih dahulu
        </div>
      ) : isFetchingGrs ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      ) : availableGrs?.length === 0 && !isEdit ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          Tidak ada GR tersedia untuk supplier &amp; cabang ini
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-auto pr-2 no-scrollbar">
          {availableGrs?.map((gr) => (
            <label
              key={gr.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedGrIds.includes(gr.id)}
                onChange={() => onGrToggle(gr.id)}
                disabled={isEdit}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{gr.gr_number}</div>
                <div className="text-[10px] text-gray-500">
                  {new Date(gr.received_date).toLocaleDateString()}
                </div>
              </div>
            </label>
          ))}

          {isEdit && existingGrLinks?.map((gl) => (
            <div
              key={gl.goods_receipt_id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10"
            >
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {gl.goods_receipt_number}
                </div>
                <div className="text-[10px] text-gray-500">
                  {new Date(gl.received_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
