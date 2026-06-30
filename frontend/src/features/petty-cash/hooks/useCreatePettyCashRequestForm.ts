import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { useCreatePettyCashRequest } from "../api/pettyCash.api";

export type CreatePettyCashRequestForm = {
  branch_id: string;
  amount_requested: number | "";
  petty_cash_coa_id: string;
  description: string;
};

const EMPTY_FORM: CreatePettyCashRequestForm = {
  branch_id: "",
  amount_requested: "",
  petty_cash_coa_id: "",
  description: "",
};

export function useCreatePettyCashRequestForm() {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<CreatePettyCashRequestForm>(EMPTY_FORM);
  const createMutation = useCreatePettyCashRequest();

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  const handleSubmit = async () => {
    if (
      !form.branch_id ||
      form.amount_requested === "" ||
      !form.petty_cash_coa_id
    ) {
      toast.error("Cabang, jumlah, dan COA Petty Cash wajib diisi");
      return;
    }
    try {
      await createMutation.mutateAsync({
        branch_id: form.branch_id,
        amount_requested: form.amount_requested,
        petty_cash_coa_id: form.petty_cash_coa_id,
        description: form.description || undefined,
      });
      toast.success("Request berhasil dibuat");
      setIsOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(parseApiError(err, "Gagal membuat request kas kecil"));
    }
  };

  return {
    isOpen,
    open,
    close,
    form,
    setForm,
    handleSubmit,
    isPending: createMutation.isPending,
  };
}
