import { useState, useEffect } from "react";
import { Printer } from "lucide-react";
import { Dialog, Button, FormField, Select } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { usePrinters, usePrintPettyCash } from "@/features/printers/api";

interface Props {
  requestId: string;
  onClose: () => void;
}

export function PrintPettyCashModal({ requestId, onClose }: Props) {
  const toast = useToast();
  const { data: printers = [], isLoading: loadingPrinters } = usePrinters();
  const printMutation = usePrintPettyCash();

  const activePrinters = printers.filter((p) => p.is_active);
  const defaultPrinter = activePrinters.find((p) => p.is_default);

  const [selectedPrinter, setSelectedPrinter] = useState(
    defaultPrinter?.id ?? "",
  );

  useEffect(() => {
    if (defaultPrinter && !selectedPrinter) {
      setSelectedPrinter(defaultPrinter.id);
    }
  }, [defaultPrinter, selectedPrinter]);

  const handleClose = () => {
    if (printMutation.isPending) return;
    onClose();
  };

  const handlePrint = async () => {
    if (!selectedPrinter) {
      toast.error("Pilih printer");
      return;
    }
    try {
      await printMutation.mutateAsync({
        requestId,
        printer_id: selectedPrinter,
      });
      toast.success("Print job terkirim");
      onClose();
    } catch (err) {
      toast.error(parseApiError(err, "Gagal print"));
    }
  };

  return (
    <Dialog
      isOpen
      onClose={handleClose}
      size="sm"
      preventClose={printMutation.isPending}
    >
      <Dialog.Header>
        <span className="flex items-center gap-2">
          <Printer
            className="h-5 w-5 shrink-0 text-teal-600"
            aria-hidden="true"
          />
          Print Thermal — Kas Kecil
        </span>
      </Dialog.Header>

      <Dialog.Body className="space-y-4">
        <FormField label="Printer">
          {({ inputId, describedBy }) =>
            loadingPrinters ? (
              <div className="h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
            ) : activePrinters.length === 0 ? (
              <p className="text-xs text-red-500">
                Tidak ada printer aktif. Konfigurasi printer di menu Settings.
              </p>
            ) : (
              <Select
                id={inputId}
                aria-describedby={describedBy}
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
              >
                <option value="">Pilih Printer</option>
                {activePrinters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.printer_name} ({p.ip_address}) {p.is_default ? "⭐" : ""}
                  </option>
                ))}
              </Select>
            )
          }
        </FormField>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Akan mencetak ringkasan Petty Cash beserta rincian pengeluaran ke
          printer thermal yang dipilih.
        </p>
      </Dialog.Body>

      <Dialog.Footer>
        <Button
          variant="secondary"
          onClick={handleClose}
          disabled={printMutation.isPending}
        >
          Batal
        </Button>
        <Button
          variant="primary"
          leftIcon={<Printer className="h-4 w-4" />}
          loading={printMutation.isPending}
          disabled={!selectedPrinter}
          onClick={handlePrint}
        >
          Print
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
