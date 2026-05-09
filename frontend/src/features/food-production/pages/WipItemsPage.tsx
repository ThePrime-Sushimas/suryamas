import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Beaker,
  Plus,
  Search,
  X,
  Calculator as CalculatorIcon,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  useWipItems,
  useDeleteWipItem,
  useProductList,
} from "../api/food-production.api";

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n);

export default function WipItemsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"list" | "foodCost">("list");

  // ── Food Cost Calculator State ──
  const [calcProductId, setCalcProductId] = useState("");
  const [calcUom, setCalcUom] = useState<string>("gram");
  const [calcQty, setCalcQty] = useState<number>(1);
  const [calcYield, setCalcYield] = useState<number>(1); // Added Yield
  const [targetFoodCost, setTargetFoodCost] = useState(30);
  const [sellingPrice, setSellingPrice] = useState(0);

  const products = useProductList();

  // Sync UOM when product changes
  useEffect(() => {
    if (!calcProductId) return;
    const p = (products.data || []).find((x) => x.id === calcProductId);
    if (p?.default_purchase_unit) setCalcUom(p.default_purchase_unit);
  }, [calcProductId, products.data]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 50,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [page, debouncedSearch],
  );

  const wipItems = useWipItems(queryParams);
  const deleteWip = useDeleteWipItem();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteWip.mutateAsync(deleteId);
      toast.success("WIP dihapus");
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal menghapus WIP"));
    } finally {
      setDeleteId(null);
    }
  };

  const data = wipItems.data?.data || [];
  const pagination = wipItems.data?.pagination;

  const calcLastHppPrice = useMemo(() => {
    if (!calcProductId) return 0;
    const p = (products.data || []).find((x) => x.id === calcProductId);
    return p?.average_cost ?? 0;
  }, [calcProductId, products.data]);

  const totalProductionCost = useMemo(() => {
    const q = Number.isFinite(calcQty) ? calcQty : 0;
    return calcLastHppPrice * q;
  }, [calcLastHppPrice, calcQty]);

  const unitCost = useMemo(() => {
    const y = Number.isFinite(calcYield) && calcYield > 0 ? calcYield : 1;
    return totalProductionCost / y;
  }, [totalProductionCost, calcYield]);

  const suggestedPrice =
    targetFoodCost > 0 ? unitCost / (targetFoodCost / 100) : 0;
  const actualFoodCost =
    sellingPrice > 0 ? (unitCost / sellingPrice) * 100 : 0;
  const margin =
    sellingPrice > 0 ? ((sellingPrice - unitCost) / sellingPrice) * 100 : 0;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-purple-600 rounded-xl">
          <Beaker className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">
            Bahan Setengah Jadi (WIP)
          </h1>
          <p className="text-xs text-gray-400">
            Kelola bahan setengah jadi seperti Nasi Sushi, Saus, dll
          </p>
        </div>
        <button
          onClick={() => navigate("/food-production/wip/new")}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah WIP
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("list")}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${
            activeTab === "list"
              ? "bg-purple-50 border-purple-300 text-purple-800 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-300"
          }`}
        >
          Daftar WIP
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("foodCost")}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${
            activeTab === "foodCost"
              ? "bg-purple-50 border-purple-300 text-purple-800 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-300"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <CalculatorIcon className="w-4 h-4" />
            Food Cost Calculator
          </span>
        </button>
      </div>

      {activeTab === "list" && (
        <>
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari WIP..."
              className="w-full h-9 pl-8 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-1 focus:ring-purple-500 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      Kode
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      Nama WIP
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Hasil/Batch
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Cost/Batch
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                      Cost/Unit
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {wipItems.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7} className="px-3 py-3">
                          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-12 text-center text-gray-400"
                      >
                        Belum ada WIP
                      </td>
                    </tr>
                  ) : (
                    data.map((w) => (
                      <tr
                        key={w.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                        onClick={() => navigate(`/food-production/wip/${w.id}`)}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-500">
                          {w.wip_code}
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 dark:text-white font-medium">
                          {w.wip_name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {w.yield_qty}{" "}
                          <span className="text-gray-400 text-xs">{w.uom}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {w.estimated_cost > 0 ? fmt(w.estimated_cost) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-medium">
                          {w.cost_per_unit > 0 ? fmt(w.cost_per_unit) : "—"}
                        </td>
                        <td
                          className="px-3 py-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setDeleteId(w.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <Pagination
                  pagination={pagination}
                  onPageChange={setPage}
                  currentLength={data.length}
                />
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "foodCost" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Inputs Card */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <CalculatorIcon className="w-4 h-4 text-purple-600" />
                Parameter Kalkulasi
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                      Pilih Produk / WIP
                    </label>
                    <select
                      value={calcProductId}
                      onChange={(e) => setCalcProductId(e.target.value)}
                      className="w-full h-11 px-4 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                    >
                      <option value="">Pilih product...</option>
                      {(products.data || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product_name} ({p.default_purchase_unit || "unit"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                      Kuantitas Bahan (Input)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={calcQty || ""}
                        onChange={(e) => setCalcQty(Number(e.target.value))}
                        placeholder="0"
                        className="w-full h-11 px-4 text-lg font-mono border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {calcUom || "Unit"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                      Hasil Jadi (Yield)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={calcYield || ""}
                        onChange={(e) => setCalcYield(Number(e.target.value))}
                        placeholder="1"
                        className="w-full h-11 px-4 text-lg font-mono border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Porsi
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                      Target Food Cost %
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={targetFoodCost || ""}
                        onChange={(e) =>
                          setTargetFoodCost(Number(e.target.value))
                        }
                        className="w-full h-11 px-4 text-lg font-mono border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-purple-500 outline-none text-purple-600"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                        %
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-400 italic">
                      Harga jual disarankan:{" "}
                      <span className="text-purple-600 font-bold font-mono">
                        Rp {fmt(Math.ceil(suggestedPrice))}
                      </span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                      Harga Jual Aktual (per porsi)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 uppercase">
                        Rp
                      </span>
                      <input
                        type="number"
                        value={sellingPrice || ""}
                        onChange={(e) =>
                          setSellingPrice(Number(e.target.value))
                        }
                        placeholder="0"
                        className="w-full h-11 pl-12 pr-4 text-lg font-mono border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-purple-500 outline-none font-bold"
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-gray-400 italic">Masukkan harga jual per 1 porsi hasil</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Result Card */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 shadow-xl shadow-purple-500/20 text-white flex flex-col justify-between">
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-purple-200 opacity-80">
                Hasil Analisa
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                  <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                    Cost per Porsi
                  </span>
                  <div className="text-right">
                    <p className="text-2xl font-black font-mono">
                      Rp {fmt(unitCost)}
                    </p>
                    <p className="text-[10px] text-white/50">
                      Total: Rp {fmt(totalProductionCost)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-[10px] font-bold text-white/50 uppercase mb-1">
                      Food Cost %
                    </p>
                    <p
                      className={`text-xl font-black font-mono ${actualFoodCost > targetFoodCost ? "text-red-300" : "text-emerald-300"}`}
                    >
                      {actualFoodCost > 0 ? actualFoodCost.toFixed(1) : "0"}%
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-[10px] font-bold text-white/50 uppercase mb-1">
                      Margin %
                    </p>
                    <p className={`text-xl font-black font-mono ${margin < 0 ? 'text-red-300' : ''}`}>
                      {margin !== 0 ? margin.toFixed(1) : "0"}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-[10px] font-bold text-white/50 uppercase mb-1">
                Laba Kotor Estimasi
              </p>
              <p className="text-3xl font-black font-mono text-emerald-400">
                Rp {fmt(Math.max(0, sellingPrice - unitCost))}
              </p>
              <p className="text-[10px] text-white/50 mt-1 italic">
                Laba kotor per porsi (sebelum overhead)
              </p>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus WIP"
        message="Yakin ingin menghapus WIP ini?"
        confirmText="Hapus"
        variant="danger"
      />
    </div>
  );
}
