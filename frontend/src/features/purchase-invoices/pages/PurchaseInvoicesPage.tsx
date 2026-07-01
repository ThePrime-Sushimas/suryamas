import { useNavigate } from "react-router-dom";
import { useListNavigation } from "@/lib/urlFilters";
import { FileText, Plus, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { useSuppliers } from "@/features/suppliers/api/suppliers.api";
import { useBranches } from "@/features/branches/api/branches.api";
import { PI_LIST_TABS, PURCHASE_INVOICES_LIST_PATH } from "../constants";
import { InvoiceFilters } from "../components/InvoiceFilters";
import { InvoiceTableDesktop } from "../components/InvoiceTableDesktop";
import { InvoiceCardList } from "../components/InvoiceCardList";
import { usePurchaseInvoiceList } from "../hooks/usePurchaseInvoiceList";
import { usePurchaseInvoiceSelection } from "../hooks/usePurchaseInvoiceSelection";
import { usePurchaseInvoicePost } from "../hooks/usePurchaseInvoicePost";

export default function PurchaseInvoicesPage() {
  const navigate = useNavigate();
  const { openDetail } = useListNavigation(PURCHASE_INVOICES_LIST_PATH);

  // Data, filters, delete
  const {
    filters,
    setFilters,
    setPage,
    searchInput,
    setSearchInput,
    invoices,
    pagination,
    isLoading,
    counts,
    canRelease,
    canUpdate,
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    isDeletePending,
  } = usePurchaseInvoiceList();

  // Selection + merge
  const {
    selectedIds,
    isSelectionMode,
    setIsSelectionMode,
    toggleSelect,
    handleMerge,
    isMergePending,
  } = usePurchaseInvoiceSelection(filters.tab);

  // Post / unpost
  const {
    postingId,
    unpostTarget,
    setUnpostTarget,
    handlePostJournal,
    handleUnpost,
    isUnpostPending,
    disabledHint,
  } = usePurchaseInvoicePost();

  // Reference data for filters
  const { data: suppliersData } = useSuppliers();
  const { data: branchesData } = useBranches({ limit: 100 });

  const suppliers = suppliersData?.data ?? [];
  const branches = branchesData?.data ?? [];

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                Verifikasi Invoice
              </h1>
              <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                {pagination?.total ?? 0} invoice terdaftar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {filters.tab === "verify" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                className={`p-2 sm:hidden ${isSelectionMode ? "bg-indigo-100 text-indigo-600" : ""}`}
                aria-label="Toggle selection mode"
              >
                <CheckSquare className="w-5 h-5" />
              </Button>
            )}
            {filters.tab === "verify" && selectedIds.length >= 2 && (
              <Button
                variant="secondary"
                onClick={handleMerge}
                disabled={isMergePending}
                className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200"
              >
                Gabung ({selectedIds.length})
              </Button>
            )}
            {canRelease && (
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => navigate("/inventory/purchase-invoices/new")}
                title="Hanya role dengan izin release — untuk kasus khusus (auto-draft gagal / koreksi)"
              >
                <span className="hidden sm:inline">Buat Manual</span>
              </Button>
            )}
          </div>
        </div>

        <InvoiceFilters
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onSearchClear={() => setFilters({ search: "" })}
          supplierId={filters.supplierId}
          onSupplierChange={(id) => setFilters({ supplierId: id })}
          branchId={filters.branchId}
          onBranchChange={(id) => setFilters({ branchId: id })}
          suppliers={suppliers}
          branches={branches}
        />
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6">
        <div className="flex items-center gap-6 lg:gap-8 overflow-x-auto no-scrollbar">
          {PI_LIST_TABS.map((tab) => {
            const count =
              tab.id === "verify"
                ? counts?.verify_count
                : tab.id === "approval"
                  ? counts?.approval_count
                  : counts?.final_count;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilters({ tab: tab.id });
                }}
                className={`py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                  filters.tab === tab.id
                    ? `border-${tab.color}-600 text-${tab.color}-600 dark:border-${tab.color}-400 dark:text-${tab.color}-400`
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                {tab.label}
                {count !== undefined && count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                      filters.tab === tab.id
                        ? `bg-${tab.color}-100 text-${tab.color}-700 dark:bg-${tab.color}-900/30`
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
          <InvoiceTableDesktop
            invoices={invoices}
            isLoading={isLoading}
            tab={filters.tab}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onRowClick={(id) => openDetail(`/inventory/purchase-invoices/${id}`)}
            canUpdate={canUpdate}
            canRelease={canRelease}
            postingId={postingId}
            isUnpostPending={isUnpostPending}
            disabledHint={disabledHint}
            onPostJournal={handlePostJournal}
            onUnpostClick={setUnpostTarget}
            onDeleteClick={setDeleteTarget}
          />

          <InvoiceCardList
            invoices={invoices}
            isLoading={isLoading}
            tab={filters.tab}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onCardClick={(inv) => {
              if (isSelectionMode) {
                toggleSelect(inv.id);
              } else {
                openDetail(`/inventory/purchase-invoices/${inv.id}`);
              }
            }}
            canUpdate={canUpdate}
            canRelease={canRelease}
            postingId={postingId}
            isUnpostPending={isUnpostPending}
            disabledHint={disabledHint}
            onPostJournal={handlePostJournal}
            onUnpostClick={setUnpostTarget}
            onDeleteClick={setDeleteTarget}
          />
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4">
            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={() => {}}
              currentLength={invoices.length}
              loading={isLoading}
            />
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Invoice"
        message={`Yakin ingin menghapus invoice "${deleteTarget?.invoice_number}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        variant="danger"
        isLoading={isDeletePending}
      />

      <ConfirmModal
        isOpen={!!unpostTarget}
        onClose={() => setUnpostTarget(null)}
        onConfirm={handleUnpost}
        title="Batalkan Post Jurnal"
        message={
          unpostTarget
            ? `Batalkan post jurnal untuk "${unpostTarget.invoice_number}"? Jurnal akan dihapus permanen, biaya stok dikembalikan, dan status kembali ke Approved.`
            : ""
        }
        confirmText="Batalkan Post"
        variant="danger"
        isLoading={isUnpostPending}
      />
    </div>
  );
}
