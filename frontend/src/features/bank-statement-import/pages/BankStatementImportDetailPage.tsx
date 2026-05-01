/**
 * BankStatementImportDetailPage.tsx
 *
 * Halaman detail untuk 1 sesi bank statement import.
 * Data source: GET /bank-statement-imports/:id (summary + metadata)
 *              GET /bank-statement-imports/:id/statements (transaksi berhasil diimport)
 *
 * Routing: /bank-statement-import/:id
 * Letakkan file ini di: src/features/bank-statement-import/pages/BankStatementImportDetailPage.tsx
 */

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/axios";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ChevronDown,
  Copy,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Hash,
  Calendar,
} from "lucide-react";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

type ImportStatus =
  | "PENDING"
  | "ANALYZED"
  | "IMPORTING"
  | "COMPLETED"
  | "FAILED";

interface AnalysisDateRange {
  start: string;
  end: string;
}

interface ColumnMapping {
  description?: string;
  debit_amount?: string;
  credit_amount?: string;
  transaction_date?: string;
  balance?: string;
  reference_number?: string;
  [key: string]: string | undefined;
}

interface AnalysisData {
  preview?: unknown[];
  preview_raw_csv?: unknown[];
  warnings?: string[];
  date_range?: AnalysisDateRange;
  duplicates?: unknown[];
  analyzed_at?: string;
  invalid_count?: number;
  column_mapping?: ColumnMapping;
  total_raw_rows?: number;
  duplicate_count?: number;
}

interface BankAccount {
  banks?: { bank_name: string };
  account_name?: string;
  account_number?: string;
}

interface ImportDetail {
  id: number;
  company_id: string;
  bank_account_id: number;
  file_name: string;
  file_size: number | null;
  file_hash: string | null;
  status: ImportStatus;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  date_range_start: string | null;
  date_range_end: string | null;
  error_message: string | null;
  error_details: unknown | null;
  analysis_data: AnalysisData | null;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  deleted_at: string | null;
  job_id: string | null;
  bank_accounts?: BankAccount;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
}

interface BankStatement {
  id: number;
  transaction_date: string;
  transaction_time: string | null;
  reference_number: string | null;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance: number | null;
  is_reconciled: boolean;
  row_number: number | null;
}

interface StatementsResponse {
  data: BankStatement[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  // some backends return array directly
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// API HELPERS — menggunakan axios instance project (auth + branch header otomatis)
// ---------------------------------------------------------------------------

const API_BASE = "/bank-statement-imports";

async function fetchImportDetail(id: string): Promise<ImportDetail> {
  const { data: json } = await api.get(`${API_BASE}/${id}`);
  // Normalise: backend wraps in { success, data } or { data }
  return json.data ?? json;
}

async function fetchStatements(
  id: string,
  page: number,
  limit: number,
): Promise<{ rows: BankStatement[]; hasMore: boolean; total: number }> {
  const { data: json } = await api.get(
    `${API_BASE}/${id}/statements?page=${page}&limit=${limit}`,
  );

  // Handle berbagai shape response
  const raw: StatementsResponse = json.data ?? json;
  const rows: BankStatement[] = Array.isArray(raw)
    ? (raw as unknown as BankStatement[])
    : Array.isArray(raw.data)
      ? (raw.data as BankStatement[])
      : [];

  const total: number =
    (raw.pagination as { total?: number } | undefined)?.total ??
    (raw as { total?: number }).total ??
    rows.length;

  const hasMore = rows.length === limit;

  return { rows, hasMore, total };
}

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: idLocale });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", {
      locale: idLocale,
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ImportStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Menunggu",
    color: "text-yellow-700 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    icon: <Clock size={14} />,
  },
  ANALYZED: {
    label: "Siap Import",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    icon: <FileText size={14} />,
  },
  IMPORTING: {
    label: "Sedang Import",
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    icon: <Loader2 size={14} className="animate-spin" />,
  },
  COMPLETED: {
    label: "Selesai",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30",
    icon: <CheckCircle2 size={14} />,
  },
  FAILED: {
    label: "Gagal",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
    icon: <XCircle size={14} />,
  },
};

function StatusBadge({ status }: { status: ImportStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "red" | "blue" | "gray";
}) {
  const accentMap = {
    green: "border-l-green-500",
    red: "border-l-red-500",
    blue: "border-l-blue-500",
    gray: "border-l-gray-400",
  };
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 ${
        accentMap[accent ?? "gray"]
      } p-4`}
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {typeof value === "number" ? value.toLocaleString("id-ID") : value}
      </p>
      {sub && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

function CopyableHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      title="Salin hash"
      className="flex items-center gap-1 font-mono text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
    >
      <span className="truncate max-w-[180px]">{hash}</span>
      <Copy size={12} className={copied ? "text-green-500" : ""} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// TRANSACTION TABLE
// ---------------------------------------------------------------------------

const STATEMENTS_PAGE_SIZE = 50;

function TransactionTable({
  importId,
  importStatus,
}: {
  importId: string;
  importStatus: ImportStatus;
}) {
  const [rows, setRows] = useState<BankStatement[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStatements(importId, 1, STATEMENTS_PAGE_SIZE)
      .then(({ rows: r, hasMore: more, total: t }) => {
        if (cancelled) return;
        setRows(r);
        setHasMore(more);
        setTotal(t);
        setPage(1);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message ?? "Gagal memuat transaksi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [importId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { rows: more, hasMore: stillMore } = await fetchStatements(
        importId,
        nextPage,
        STATEMENTS_PAGE_SIZE,
      );
      setRows((prev) => [...prev, ...more]);
      setHasMore(stillMore);
      setPage(nextPage);
    } catch (e) {
      setError((e as Error).message ?? "Gagal memuat lebih banyak data");
    } finally {
      setLoadingMore(false);
    }
  }, [importId, page, hasMore, loadingMore]);

  if (loading) {
    return (
      <div className="space-y-2 py-6">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-700 dark:text-red-400">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  if (importStatus === "IMPORTING") {
    return (
      <div className="flex items-center gap-3 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-sm text-purple-700 dark:text-purple-400">
        <Loader2 size={16} className="animate-spin shrink-0" />
        <span>
          Import sedang berjalan. Data transaksi akan muncul setelah selesai.
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-gray-500 dark:text-gray-400">
        <FileText size={32} className="opacity-30" />
        <p className="font-medium">
          Tidak ada transaksi yang berhasil diimport
        </p>
        <p className="text-xs">
          Kemungkinan semua baris diskip sebagai duplikat atau import gagal
          sebelum memproses data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Row count info */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>
          Menampilkan{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            {rows.length}
          </span>
          {total > rows.length ? ` dari ${total.toLocaleString("id-ID")}` : ""}{" "}
          transaksi
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Tanggal</th>
              <th className="px-4 py-3 text-left">Keterangan</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Kredit</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-center">Rekonsiliasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300 font-mono text-xs">
                  {formatDate(row.transaction_date)}
                </td>
                <td className="px-4 py-3 max-w-[320px]">
                  <p
                    className="text-gray-900 dark:text-white truncate"
                    title={row.description}
                  >
                    {row.description}
                  </p>
                  {row.reference_number && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                      {row.reference_number}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {row.debit_amount > 0 ? (
                    <span className="flex items-center justify-end gap-1 text-red-600 dark:text-red-400 font-medium">
                      <TrendingDown size={12} />
                      {formatCurrency(row.debit_amount)}
                    </span>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {row.credit_amount > 0 ? (
                    <span className="flex items-center justify-end gap-1 text-green-600 dark:text-green-400 font-medium">
                      <TrendingUp size={12} />
                      {formatCurrency(row.credit_amount)}
                    </span>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-gray-700 dark:text-gray-300 font-mono text-xs">
                  {row.balance != null ? formatCurrency(row.balance) : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.is_reconciled ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 size={13} /> Ya
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Belum
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Memuat...
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                Muat lebih banyak
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------

export function BankStatementImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [importData, setImportData] = useState<ImportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchImportDetail(id)
      .then(setImportData)
      .catch((e) => setError(e.message ?? "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [id]);

  // -------------------------------------------------------------------------
  // LOADING STATE
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // ERROR STATE
  // -------------------------------------------------------------------------
  if (error || !importData) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
        >
          <ArrowLeft size={16} /> Kembali
        </button>
        <div className="flex flex-col items-center gap-3 py-16 text-center text-gray-500 dark:text-gray-400">
          <AlertCircle size={40} className="text-red-400" />
          <p className="font-semibold text-gray-900 dark:text-white">
            Gagal memuat data
          </p>
          <p className="text-sm">{error ?? "Data tidak ditemukan"}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Kembali ke daftar
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // DERIVED DATA — semua optional-chained karena analysis_data bisa null
  // -------------------------------------------------------------------------
  const analysis = importData.analysis_data;
  const bankName =
    importData.bank_name ?? importData.bank_accounts?.banks?.bank_name ?? "-";
  const accountNumber =
    importData.account_number ??
    importData.bank_accounts?.account_number ??
    "-";
  const accountName =
    importData.account_name ?? importData.bank_accounts?.account_name ?? "-";

  const dateStart =
    importData.date_range_start ?? analysis?.date_range?.start ?? null;
  const dateEnd =
    importData.date_range_end ?? analysis?.date_range?.end ?? null;

  const warnings = analysis?.warnings ?? [];
  const duplicateCount = analysis?.duplicate_count ?? 0;
  const invalidCount = analysis?.invalid_count ?? 0;
  const totalRawRows = analysis?.total_raw_rows ?? importData.total_rows;

  // Skipped = total raw - processed - failed
  const skippedRows = Math.max(
    0,
    totalRawRows - importData.processed_rows - importData.failed_rows,
  );

  const isCompleted = importData.status === "COMPLETED";
  const isFailed = importData.status === "FAILED";

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate(-1)}
            className="mt-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white break-all">
                {importData.file_name}
              </h1>
              <StatusBadge status={importData.status} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {bankName} · {accountNumber} · {accountName}
            </p>
          </div>
        </div>
      </div>

      {/* ── Warnings dari analysis ── */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
            <AlertTriangle size={16} />
            Peringatan Analisis
          </div>
          {warnings.map((w, i) => (
            <p
              key={i}
              className="text-sm text-amber-700 dark:text-amber-300 pl-6"
            >
              {w}
            </p>
          ))}
        </div>
      )}

      {/* ── Error detail (status FAILED) ── */}
      {isFailed && importData.error_message && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm mb-1">
            <XCircle size={16} />
            Penyebab Kegagalan
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 pl-6 font-mono">
            {importData.error_message}
          </p>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Baris File"
          value={totalRawRows}
          sub="baris ditemukan di file"
          accent="gray"
        />
        <StatCard
          label="Berhasil Diimport"
          value={importData.processed_rows}
          sub={isCompleted ? "tersimpan di sistem" : "-"}
          accent="green"
        />
        <StatCard
          label="Diskip"
          value={skippedRows}
          sub={
            duplicateCount > 0
              ? `${duplicateCount} duplikat`
              : "baris tidak diproses"
          }
          accent="blue"
        />
        <StatCard
          label="Gagal"
          value={importData.failed_rows + invalidCount}
          sub={
            invalidCount > 0
              ? `${invalidCount} baris tidak valid`
              : "baris error"
          }
          accent={importData.failed_rows + invalidCount > 0 ? "red" : "gray"}
        />
      </div>

      {/* ── Metadata Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info File */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText size={15} className="text-gray-400" />
            Informasi File
          </h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <dt className="text-gray-500 dark:text-gray-400">Ukuran</dt>
              <dd className="font-medium text-gray-900 dark:text-white font-mono text-xs">
                {formatFileSize(importData.file_size)}
              </dd>
            </div>
            {importData.file_hash && (
              <div className="flex justify-between items-center">
                <dt className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Hash size={12} /> SHA-256
                </dt>
                <dd>
                  <CopyableHash hash={importData.file_hash} />
                </dd>
              </div>
            )}
            <div className="flex justify-between items-center">
              <dt className="text-gray-500 dark:text-gray-400">Diupload</dt>
              <dd className="font-medium text-gray-900 dark:text-white text-xs">
                {formatDateTime(importData.created_at)}
              </dd>
            </div>
            {importData.updated_at && (
              <div className="flex justify-between items-center">
                <dt className="text-gray-500 dark:text-gray-400">Diperbarui</dt>
                <dd className="font-medium text-gray-900 dark:text-white text-xs">
                  {formatDateTime(importData.updated_at)}
                </dd>
              </div>
            )}
            {analysis?.analyzed_at && (
              <div className="flex justify-between items-center">
                <dt className="text-gray-500 dark:text-gray-400">Dianalisis</dt>
                <dd className="font-medium text-gray-900 dark:text-white text-xs">
                  {formatDateTime(analysis.analyzed_at)}
                </dd>
              </div>
            )}
            {importData.job_id && (
              <div className="flex justify-between items-center">
                <dt className="text-gray-500 dark:text-gray-400">Job ID</dt>
                <dd>
                  <CopyableHash hash={importData.job_id} />
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Rentang Tanggal + Column Mapping */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar size={15} className="text-gray-400" />
              Rentang Transaksi
            </h2>
            {dateStart && dateEnd ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium text-gray-900 dark:text-white">
                  {formatDate(dateStart)}
                </span>
                <span className="text-gray-400">—</span>
                <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium text-gray-900 dark:text-white">
                  {formatDate(dateEnd)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Tidak tersedia
              </p>
            )}
          </div>

          {/* Column mapping dari analisis */}
          {analysis?.column_mapping &&
            Object.keys(analysis.column_mapping).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Pemetaan Kolom
                </h3>
                <dl className="space-y-1.5">
                  {Object.entries(analysis.column_mapping).map(([key, col]) =>
                    col ? (
                      <div key={key} className="flex justify-between text-xs">
                        <dt className="text-gray-500 dark:text-gray-400 capitalize">
                          {key.replace(/_/g, " ")}
                        </dt>
                        <dd className="font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {col}
                        </dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </div>
            )}
        </div>
      </div>

      {/* ── Tabel Transaksi ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Transaksi Berhasil Diimport
          </h2>
          {importData.status === "COMPLETED" &&
            importData.processed_rows === 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
                Semua baris diskip
              </span>
            )}
        </div>

        {id && (
          <TransactionTable importId={id} importStatus={importData.status} />
        )}
      </div>
    </div>
  );
}

export default BankStatementImportDetailPage;
