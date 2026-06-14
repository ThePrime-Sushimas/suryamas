import { useState, useEffect } from "react";
import {
  X,
  CheckCircle,
  XCircle,
  Banknote,
  AlertCircle,
  Search,
} from "lucide-react";
import { getSignedStorageUrl } from "@/lib/storage";
import { PaymentProofUpload } from "@/features/ap-payments/components/PaymentProofUpload";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { useGeneralPaymentFilters } from "../hooks/useGeneralPaymentFilters";
import { useOwnerCreditCards } from "@/features/marketplace-po/api/marketplacePo.api";
import {
  useCreateGeneralPayment,
  useApproveGeneralPayment,
  useRejectGeneralPayment,
  useUploadProofGeneralPayment,
  useMarkPaidGeneralPayment,
  useDeleteGeneralPayment,
  useGeneralPayments,
  useGeneralPayment,
} from "../api/generalApi.api";

import {
  formatRupiah,
  formatDate,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from "../constants";
import type {
  GeneralInvoice,
  GeneralInvoicePayment,
  GeneralPaymentStatus,
} from "../api/generalApi.api";

// ─── Note: Replace with your actual BankAccount hook/type ────
interface BankAccount {
  id: number;
  account_name: string;
  bank_name?: string;
}

// ============================================================
// CREATE PAYMENT MODAL
// ============================================================
interface CreatePaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoice: GeneralInvoice | null;
  bankAccounts?: BankAccount[];
}

export function CreatePaymentModal({
  open,
  onClose,
  invoice,
  bankAccounts = [],
}: CreatePaymentModalProps) {
  const createMutation = useCreateGeneralPayment();
  const { data: ownerCards = [] } = useOwnerCreditCards({ is_active: true });

  const [bankAccountId, setBankAccountId] = useState<number | "">("");
  const [ownerCreditCardId, setOwnerCreditCardId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<
    "TRANSFER" | "CASH" | "CC_OWNER"
  >("TRANSFER");
  const [totalAmount, setTotalAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && invoice) {
      setTotalAmount(String(invoice.total_amount));
      setBankAccountId("");
      setOwnerCreditCardId("");
      setPaymentMethod("TRANSFER");
      setPaymentDate("");
      setNotes("");
      setErrors({});
      if (
        invoice.active_payment &&
        !["REJECTED", "PAID", "RECONCILED"].includes(
          invoice.active_payment.status,
        )
      ) {
        setErrors({
          form: `Payment ${invoice.active_payment.payment_number} sudah ada (status: ${PAYMENT_STATUS_LABELS[invoice.active_payment.status]}). Lanjutkan di halaman Payments.`,
        });
      }
    }
  }, [open, invoice]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (paymentMethod === "CC_OWNER") {
      if (!ownerCreditCardId)
        errs.ownerCreditCardId = "Kartu kredit wajib dipilih";
    } else if (paymentMethod === "TRANSFER") {
      if (!bankAccountId) errs.bankAccountId = "Rekening bank wajib dipilih";
    }
    if (!totalAmount || parseFloat(totalAmount) <= 0)
      errs.totalAmount = "Nominal wajib diisi";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!invoice || !validate()) return;
    if (
      invoice.active_payment &&
      !["REJECTED", "PAID", "RECONCILED"].includes(
        invoice.active_payment.status,
      )
    ) {
      return;
    }
    await createMutation.mutateAsync({
      general_invoice_id: invoice.id,
      bank_account_id:
        paymentMethod === "TRANSFER" ? (bankAccountId as number) : null,
      owner_credit_card_id:
        paymentMethod === "CC_OWNER" ? ownerCreditCardId : null,
      payment_method: paymentMethod,
      total_amount: parseFloat(totalAmount),
      payment_date: paymentDate || null,
      notes: notes || null,
    });
    onClose();
  };

  if (!open || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Buat Payment</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errors.form && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* Invoice ref */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-xs text-gray-500">Invoice</p>
            <p className="text-sm font-semibold text-gray-900">
              {invoice.invoice_number}
            </p>
            <p className="text-xs text-gray-500">
              {invoice.vendor_name} · {formatRupiah(invoice.total_amount)}
            </p>
          </div>

          {/* Method */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">
              Metode
            </label>
            <div className="flex gap-2">
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(
                      opt.value as "TRANSFER" | "CASH" | "CC_OWNER",
                    );
                    // Reset selections when switching method
                    if (opt.value === "CC_OWNER") {
                      setBankAccountId("");
                    } else {
                      setOwnerCreditCardId("");
                    }
                  }}
                  className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                    paymentMethod === opt.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bank account or CC Owner */}
          {paymentMethod === "TRANSFER" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">
                Rekening Bank *
              </label>
              <select
                value={bankAccountId}
                onChange={(e) =>
                  setBankAccountId(e.target.value ? Number(e.target.value) : "")
                }
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.bankAccountId ? "border-red-400" : "border-gray-200"}`}
              >
                <option value="">-- Pilih Rekening --</option>
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>
                    {ba.account_name}
                    {ba.bank_name ? ` (${ba.bank_name})` : ""}
                  </option>
                ))}
              </select>
              {errors.bankAccountId && (
                <p className="text-xs text-red-500">{errors.bankAccountId}</p>
              )}
            </div>
          )}

          {paymentMethod === "CC_OWNER" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">
                Kartu Kredit*
              </label>
              <select
                value={ownerCreditCardId}
                onChange={(e) => setOwnerCreditCardId(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.ownerCreditCardId ? "border-red-400" : "border-gray-200"}`}
              >
                <option value="">-- Pilih Credit Card --</option>
                {ownerCards.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.card_label} ({cc.coa_code})
                  </option>
                ))}
              </select>
              {errors.ownerCreditCardId && (
                <p className="text-xs text-red-500">
                  {errors.ownerCreditCardId}
                </p>
              )}
              <p className="text-[11px] text-gray-400">
                Hutang akan dicatat ke akun CC owner, lalu dilunasi di halaman
                CC Settlements
              </p>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">
              Nominal *
            </label>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.totalAmount ? "border-red-400" : "border-gray-200"}`}
            />
            {errors.totalAmount && (
              <p className="text-xs text-red-500">{errors.totalAmount}</p>
            )}
          </div>

          {/* Date + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">
                Tgl Rencana Bayar
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">
                Catatan
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="(opsional)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !!errors.form}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {createMutation.isPending ? "Membuat..." : "Buat Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAYMENT DETAIL / ACTIONS MODAL
// ============================================================
interface PaymentActionsModalProps {
  open: boolean;
  onClose: () => void;
  payment: GeneralInvoicePayment | null;
}

export function PaymentActionsModal({
  open,
  onClose,
  payment,
}: PaymentActionsModalProps) {
  const toast = useToast();
  const approveMutation = useApproveGeneralPayment();
  const rejectMutation = useRejectGeneralPayment();
  const uploadProofMutation = useUploadProofGeneralPayment();

  const markPaidMutation = useMarkPaidGeneralPayment();
  const deleteMutation = useDeleteGeneralPayment();

  const paymentId = payment?.id ?? "";
  const { data: freshPayment } = useGeneralPayment(paymentId);
  const displayPayment = open && freshPayment ? freshPayment : payment;

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofViewUrl, setProofViewUrl] = useState<string | null>(null);
  const [proofViewLoading, setProofViewLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [paidDate, setPaidDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showMarkPaidForm, setShowMarkPaidForm] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (open && payment) {
      setProofFile(null);
      setRejectReason("");
      setShowRejectForm(false);
      setShowMarkPaidForm(false);
      setShowConfirmDelete(false);
    }
  }, [open, payment]);

  useEffect(() => {
    if (!open || !displayPayment?.proof_url) {
      setProofViewUrl(null);
      setProofViewLoading(false);
      return;
    }
    const raw = displayPayment.proof_url;
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      setProofViewUrl(raw);
      return;
    }
    let cancelled = false;
    setProofViewLoading(true);
    getSignedStorageUrl(raw, "invoices")
      .then((url) => {
        if (!cancelled) setProofViewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setProofViewUrl(null);
      })
      .finally(() => {
        if (!cancelled) setProofViewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, displayPayment?.proof_url]);

  if (!open || !payment || !displayPayment) return null;

  const isPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    uploadProofMutation.isPending ||
    markPaidMutation.isPending ||
    deleteMutation.isPending;

  const handleApprove = async () => {
    await approveMutation.mutateAsync(displayPayment.id);
    onClose();
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    await rejectMutation.mutateAsync({
      id: displayPayment.id,
      reason: rejectReason,
    });
    onClose();
  };

  const handleUploadProof = async () => {
    if (!proofFile) {
      toast.warning("Pilih file bukti pembayaran");
      return;
    }
    try {
      await uploadProofMutation.mutateAsync({
        id: displayPayment.id,
        file: proofFile,
      });
      toast.success("Bukti pembayaran diupload");
      setProofFile(null);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal upload bukti"));
    }
  };

  const openProof = async () => {
    if (!displayPayment.proof_url) return;
    try {
      const url =
        proofViewUrl ??
        (await getSignedStorageUrl(displayPayment.proof_url, "invoices"));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Gagal membuka bukti");
    }
  };

  const handleMarkPaid = async () => {
    await markPaidMutation.mutateAsync({
      id: displayPayment.id,
      payment_date: paidDate,
    });
    onClose();
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(displayPayment.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Detail Payment</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Payment info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-500">
                {displayPayment.payment_number}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[displayPayment.status]}`}
              >
                {PAYMENT_STATUS_LABELS[displayPayment.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Vendor</p>
                <p className="font-medium text-gray-900">
                  {displayPayment.vendor_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Nominal</p>
                <p className="font-bold text-gray-900">
                  {formatRupiah(displayPayment.total_amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Metode</p>
                <p className="text-gray-700">{displayPayment.payment_method}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Rekening</p>
                <p className="text-gray-700">
                  {displayPayment.bank_account_name ?? "-"}
                </p>
              </div>
              {displayPayment.paid_at && (
                <div>
                  <p className="text-xs text-gray-400">Lunas pada</p>
                  <p className="text-gray-700">
                    {formatDate(displayPayment.paid_at)}
                  </p>
                </div>
              )}
              {displayPayment.journal_number && (
                <div>
                  <p className="text-xs text-gray-400">No. Jurnal</p>
                  <p className="font-mono text-xs text-gray-700">
                    {displayPayment.journal_number}
                  </p>
                </div>
              )}
            </div>

            {displayPayment.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                <AlertCircle
                  size={14}
                  className="text-red-500 shrink-0 mt-0.5"
                />
                <p className="text-xs text-red-700">
                  {displayPayment.rejection_reason}
                </p>
              </div>
            )}
          </div>

          {/* Bukti pembayaran */}
          {["APPROVED", "PAID"].includes(displayPayment.status) && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-600">
                Bukti Pembayaran
              </p>
              <PaymentProofUpload
                groupKey={displayPayment.id}
                file={proofFile}
                batchFile={null}
                onFileChange={setProofFile}
                error={null}
                variant="plain"
                existingProofPath={displayPayment.proof_url}
                existingProofViewUrl={proofViewUrl}
                loadingExistingProof={proofViewLoading}
                onOpenExistingProof={
                  displayPayment.proof_url ? openProof : undefined
                }
              />
              {proofFile && (
                <button
                  type="button"
                  onClick={handleUploadProof}
                  disabled={uploadProofMutation.isPending}
                  className="w-full py-2.5 text-sm bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {uploadProofMutation.isPending
                    ? "Mengupload…"
                    : "Simpan bukti"}
                </button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {/* DRAFT actions */}
            {displayPayment.status === "DRAFT" && (
              <>
                {!showRejectForm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleApprove}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
                    >
                      <CheckCircle size={14} /> Setujui
                    </button>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 text-sm rounded-lg font-medium border border-red-200 hover:bg-red-100"
                    >
                      <XCircle size={14} /> Tolak
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">
                      Alasan Penolakan *
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder="Tulis alasan penolakan..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRejectForm(false)}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={
                          !rejectReason.trim() || rejectMutation.isPending
                        }
                        className="flex-1 py-2 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60"
                      >
                        {rejectMutation.isPending
                          ? "Menolak..."
                          : "Konfirmasi Tolak"}
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="w-full py-2 text-xs text-red-500 hover:text-red-700 text-center"
                >
                  Hapus Payment
                </button>
              </>
            )}

            {/* APPROVED actions */}
            {displayPayment.status === "APPROVED" && (
              <>
                {!showMarkPaidForm ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowMarkPaidForm(true)}
                      disabled={!displayPayment.proof_url}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Banknote size={14} /> Tandai Lunas
                    </button>
                    {!displayPayment.proof_url && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle size={12} /> Upload bukti pembayaran terlebih dahulu sebelum tandai lunas
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600">
                      Tanggal Bayar
                    </label>
                    <input
                      type="date"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowMarkPaidForm(false)}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleMarkPaid}
                        disabled={markPaidMutation.isPending}
                        className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
                      >
                        {markPaidMutation.isPending
                          ? "Memproses..."
                          : "Konfirmasi Lunas"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Confirm delete */}
          {showConfirmDelete && (
            <div className="border border-red-200 bg-red-50 rounded-xl p-3 space-y-2">
              <p className="text-sm text-red-700 font-medium">
                Hapus payment ini?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteMutation.isPending ? "..." : "Hapus"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAYMENT LIST PAGE
// ============================================================
interface PaymentListPageProps {
  onSelectPayment?: (payment: GeneralInvoicePayment) => void;
}

export function GeneralPaymentsPage({ onSelectPayment }: PaymentListPageProps) {
  const [selectedPayment, setSelectedPayment] =
    useState<GeneralInvoicePayment | null>(null);
  const {
    filters,
    searchInput,
    setSearchInput,
    apiQuery,
    setFilters,
    setPage,
  } = useGeneralPaymentFilters();

  const { data, isLoading } = useGeneralPayments(apiQuery);

  const payments = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">General Payments</h1>
        <p className="text-sm text-gray-500">
          {data?.pagination?.total ?? 0} total payment
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Cari no. payment, invoice, atau vendor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) =>
            setFilters({ status: e.target.value as GeneralPaymentStatus | "" })
          }
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Status</option>
          {PAYMENT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat...</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Banknote size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Tidak ada payment</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    No. Payment
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Vendor
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Cabang
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    No. Invoice
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Metode
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Rek. Perusahaan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Rek. Tujuan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Tgl Bayar
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Nominal
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((pay) => (
                  <tr
                    key={pay.id}
                    onClick={() => {
                      onSelectPayment?.(pay);
                      setSelectedPayment(pay);
                    }}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-900">
                      {pay.payment_number}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {pay.vendor_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {pay.branch_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {pay.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {pay.payment_method}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {pay.bank_account_name ?? pay.owner_credit_card_label ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {pay.vendor_bank_name && pay.vendor_bank_account_number
                        ? `${pay.vendor_bank_name} – ${pay.vendor_bank_account_number}`
                        : pay.vendor_bank_account_number
                          ? pay.vendor_bank_account_number
                          : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {pay.payment_date ? formatDate(pay.payment_date) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatRupiah(pay.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[pay.status]}`}
                      >
                        {PAYMENT_STATUS_LABELS[pay.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Hal {filters.page} dari {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={filters.page === 1}
              onClick={() => setPage(filters.page - 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              ← Prev
            </button>
            <button
              disabled={filters.page === totalPages}
              onClick={() => setPage(filters.page + 1)}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      <PaymentActionsModal
        open={!!selectedPayment}
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
}
