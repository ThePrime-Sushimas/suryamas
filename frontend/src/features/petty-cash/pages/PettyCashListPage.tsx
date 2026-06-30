import { useState } from "react";
import { Plus, Search, X, Loader2, Wallet } from "lucide-react";
import { Button, Input, Select, DateInput, Dialog } from "@/components/ui";
import { Pagination } from "@/components/ui/Pagination";
import { useUrlFilters, useListNavigation } from "@/lib/urlFilters";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import { useBranches } from "@/features/branches/api/branches.api";
import {
  usePettyCashRequests,
  useDeletePettyCashRequest,
} from "../api/pettyCash.api";
import { useCoaOptions } from "@/features/food-production/api/food-production.api";
import { PettyCashCreateModal } from "../components/PettyCashCreateModal";
import { RequestTableDesktop } from "../components/RequestTableDesktop";
import { RequestCardList } from "../components/RequestCardList";
import { useCreatePettyCashRequestForm } from "../hooks/useCreatePettyCashRequestForm";
import { pettyCashFilterConfig } from "../utils/pettyCashFilters.url";
import { PETTY_CASH_STATUS_LABELS } from "../types/pettyCash.status";
import type { PettyCashRequestStatus } from "../types/pettyCash.types";

const STATUS_OPTIONS: Array<{
  value: "" | PettyCashRequestStatus;
  label: string;
}> = [
  { value: "", label: "Semua status" },
  { value: "PENDING", label: PETTY_CASH_STATUS_LABELS.PENDING },
  { value: "DISBURSED", label: PETTY_CASH_STATUS_LABELS.DISBURSED },
  { value: "CLOSED", label: PETTY_CASH_STATUS_LABELS.CLOSED },
  { value: "REJECTED", label: PETTY_CASH_STATUS_LABELS.REJECTED },
];

const CARD_SHELL =
  "overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800";

export default function PettyCashListPage() {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canInsert = hasPermission("petty_cash", "insert");

  const {
    filters,
    searchInput,
    setSearchInput,
    setFilters,
    resetFilters,
    setPage,
  } = useUrlFilters(pettyCashFilterConfig);
  const { openDetail } = useListNavigation("/finance/petty-cash");

  const { data, isLoading } = usePettyCashRequests({
    branch_id: filters.branch_id || undefined,
    status: (filters.status as PettyCashRequestStatus) || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    search: filters.search || undefined,
    page: filters.page,
    limit: filters.limit,
  });

  const { data: branchesData } = useBranches({ limit: 100 });
  const { data: coaOptions } = useCoaOptions();
  const branches = branchesData?.data ?? [];
  const pettyCashCoaOptions = coaOptions ?? [];

  const createRequest = useCreatePettyCashRequestForm();
  const deleteRequest = useDeletePettyCashRequest();

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const hasActiveFilters =
    filters.branch_id ||
    filters.status ||
    filters.date_from ||
    filters.date_to ||
    filters.search;

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    await deleteRequest.mutateAsync(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="mx-auto max-w-10xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Petty Cash
          </h1>
        </div>
        {canInsert && (
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={createRequest.open}
          >
            Buat Request
          </Button>
        )}
      </div>

      <div className={`${CARD_SHELL} p-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari no. request..."
              leftIcon={<Search className="h-4 w-4" />}
              className={searchInput ? "pr-9" : undefined}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select
            value={filters.branch_id}
            onChange={(e) => setFilters({ branch_id: e.target.value })}
            className="w-full sm:w-auto sm:min-w-40"
          >
            <option value="">Semua cabang</option>
            {branches
              .filter((b) => b.status === "active")
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name}
                </option>
              ))}
          </Select>

          <Select
            value={filters.status}
            onChange={(e) =>
              setFilters({
                status: e.target.value as "" | PettyCashRequestStatus,
              })
            }
            className="w-full sm:w-auto sm:min-w-[140px]"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          <DateInput
            value={filters.date_from}
            onChange={(e) => setFilters({ date_from: e.target.value })}
            className="w-full sm:w-auto"
            aria-label="Tanggal dari"
          />

          <DateInput
            value={filters.date_to}
            onChange={(e) => setFilters({ date_to: e.target.value })}
            className="w-full sm:w-auto"
            aria-label="Tanggal sampai"
          />

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className={`${CARD_SHELL} flex justify-center py-16`}>
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <div
          className={`${CARD_SHELL} flex flex-col items-center px-6 py-16 text-center`}
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700/50">
            <Wallet className="h-6 w-6 text-gray-400" />
          </div>
          <p className="font-medium text-gray-900 dark:text-white">
            Belum ada request kas kecil
          </p>
          <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            {hasActiveFilters
              ? "Tidak ada data yang cocok dengan filter. Coba ubah filter atau reset."
              : "Buat request pertama untuk mencatat pengajuan petty cash cabang."}
          </p>
          {canInsert && !hasActiveFilters && (
            <Button
              variant="primary"
              size="sm"
              className="mt-5"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={createRequest.open}
            >
              Buat Request
            </Button>
          )}
        </div>
      ) : (
        <div className={CARD_SHELL}>
          <div className="hidden md:block">
            <RequestTableDesktop
              rows={rows}
              onRowClick={openDetail}
              onDelete={setDeleteId}
            />
          </div>
          <div className="md:hidden">
            <RequestCardList
              rows={rows}
              onRowClick={openDetail}
              onDelete={setDeleteId}
            />
          </div>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          pagination={{ ...pagination, page: filters.page }}
          onPageChange={setPage}
        />
      )}

      {createRequest.isOpen && (
        <PettyCashCreateModal
          onClose={createRequest.close}
          form={createRequest.form}
          setForm={createRequest.setForm}
          onSubmit={createRequest.handleSubmit}
          isPending={createRequest.isPending}
          branches={branches.filter((b) => b.status === "active")}
          pettyCashCoaOptions={pettyCashCoaOptions}
        />
      )}

      <Dialog
        isOpen={!!deleteId}
        onClose={() => !deleteRequest.isPending && setDeleteId(null)}
        size="sm"
        preventClose={deleteRequest.isPending}
      >
        <Dialog.Header>Hapus Request</Dialog.Header>
        <Dialog.Body>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Yakin ingin menghapus request ini? Data yang sudah dihapus tidak
            dapat dikembalikan.
          </p>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            variant="secondary"
            onClick={() => setDeleteId(null)}
            disabled={deleteRequest.isPending}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            loading={deleteRequest.isPending}
            onClick={handleDeleteConfirm}
          >
            Hapus
          </Button>
        </Dialog.Footer>
      </Dialog>
    </div>
  );
}
