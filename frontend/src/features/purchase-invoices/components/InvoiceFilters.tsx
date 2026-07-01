import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface Supplier {
  id: string;
  supplier_name: string;
}

interface Branch {
  id: string;
  branch_name: string;
}

interface InvoiceFiltersProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  supplierId: string;
  onSupplierChange: (id: string) => void;
  branchId: string;
  onBranchChange: (id: string) => void;
  suppliers: Supplier[];
  branches: Branch[];
}

export function InvoiceFilters({
  searchInput,
  onSearchChange,
  onSearchClear,
  supplierId,
  onSupplierChange,
  branchId,
  onBranchChange,
  suppliers,
  branches,
}: InvoiceFiltersProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Input
          type="text"
          placeholder="Cari nomor invoice, supplier, atau cabang..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className={searchInput ? "pr-9" : undefined}
        />
        {searchInput && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSearchClear}
            aria-label="Hapus pencarian"
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <Select
        value={supplierId}
        onChange={(e) => onSupplierChange(e.target.value)}
        className="min-w-[150px]"
      >
        <option value="">Semua Supplier</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.supplier_name}
          </option>
        ))}
      </Select>

      <Select
        value={branchId}
        onChange={(e) => onBranchChange(e.target.value)}
        className="min-w-[150px]"
      >
        <option value="">Semua Cabang</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.branch_name}
          </option>
        ))}
      </Select>
    </div>
  );
}
