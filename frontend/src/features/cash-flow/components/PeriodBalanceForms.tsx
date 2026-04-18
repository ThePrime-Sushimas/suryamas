import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Loader2 } from 'lucide-react';
import type { 
  CreatePeriodFormData, 
  UpdatePeriodFormData,
  AccountPeriodBalance,
  OpeningBalanceSuggestion
} from '../types/cash-flow.types';

const formatDateInput = (d: Date | string) => {
  if (typeof d === 'string') return d.split('T')[0];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// --- Schemas ---

const createPeriodSchema = z.object({
  bank_account_id: z.number(),
  period_start: z.string().min(1, 'Tanggal mulai wajib diisi'),
  period_end: z.string().min(1, 'Tanggal akhir wajib diisi'),
  opening_balance: z.number().min(0, 'Saldo awal tidak boleh negatif'),
  source: z.enum(['MANUAL', 'AUTO_PREV_PERIOD']),
  notes: z.string().optional(),
});

const updatePeriodSchema = z.object({
  period_start: z.string().min(1, 'Tanggal mulai wajib diisi'),
  period_end: z.string().min(1, 'Tanggal akhir wajib diisi'),
  opening_balance: z.number().min(0, 'Saldo awal tidak boleh negatif'),
  notes: z.string().optional(),
});

// --- Modal Wrapper ---

const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Form Components ---

export const CreatePeriodDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePeriodFormData) => void;
  isLoading?: boolean;
  bankAccountId: number;
  suggestion?: OpeningBalanceSuggestion;
}> = ({ isOpen, onClose, onSubmit, isLoading, bankAccountId, suggestion }) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm<CreatePeriodFormData>({
    resolver: zodResolver(createPeriodSchema),
    defaultValues: {
      bank_account_id: bankAccountId,
      period_start: formatDateInput(new Date()),
      period_end: formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
      opening_balance: 0,
      source: 'MANUAL',
    }
  });

  const selectedSource = watch('source');

  useEffect(() => {
    if (isOpen) {
      reset({
        bank_account_id: bankAccountId,
        period_start: formatDateInput(new Date()),
        period_end: formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
        opening_balance: suggestion?.suggested_balance || 0,
        source: suggestion ? 'AUTO_PREV_PERIOD' : 'MANUAL',
      });
    }
  }, [isOpen, bankAccountId, suggestion, reset]);

  useEffect(() => {
    if (selectedSource === 'AUTO_PREV_PERIOD' && suggestion) {
      setValue('opening_balance', suggestion.suggested_balance || 0);
    }
  }, [selectedSource, suggestion, setValue]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Buat Periode Baru">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sumber Saldo Awal</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setValue('source', 'AUTO_PREV_PERIOD')}
              disabled={!suggestion}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                selectedSource === 'AUTO_PREV_PERIOD' 
                  ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Otomatis (Prev)
            </button>
            <button
              type="button"
              onClick={() => setValue('source', 'MANUAL')}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                selectedSource === 'MANUAL' 
                  ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Manual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
            <input
              type="date"
              {...register('period_start')}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {errors.period_start && <p className="text-xs text-red-500 mt-1">{errors.period_start.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              {...register('period_end')}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {errors.period_end && <p className="text-xs text-red-500 mt-1">{errors.period_end.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Awal</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
            <input
              type="number"
              step="any"
              {...register('opening_balance', { valueAsNumber: true })}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="0"
            />
          </div>
          {errors.opening_balance && <p className="text-xs text-red-500 mt-1">{errors.opening_balance.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (Opsional)</label>
          <textarea
            {...register('notes')}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[80px]"
            placeholder="Tambahkan catatan jika perlu..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan Periode
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const EditPeriodDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UpdatePeriodFormData) => void;
  onDelete?: () => void;
  isLoading?: boolean;
  isDeleting?: boolean;
  period: AccountPeriodBalance | null;
}> = ({ isOpen, onClose, onSubmit, onDelete, isLoading, isDeleting, period }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<UpdatePeriodFormData>({
    resolver: zodResolver(updatePeriodSchema),
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && period) {
      reset({
        period_start: formatDateInput(period.period_start),
        period_end: formatDateInput(period.period_end),
        opening_balance: period.opening_balance,
        notes: period.notes || '',
      });
      setShowDeleteConfirm(false);
    }
  }, [isOpen, period, reset]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Periode">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
            <input
              type="date"
              {...register('period_start')}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {errors.period_start && <p className="text-xs text-red-500 mt-1">{errors.period_start.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              {...register('period_end')}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {errors.period_end && <p className="text-xs text-red-500 mt-1">{errors.period_end.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Awal</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
            <input
              type="number"
              step="any"
              {...register('opening_balance', { valueAsNumber: true })}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="0"
            />
          </div>
          {errors.opening_balance && <p className="text-xs text-red-500 mt-1">{errors.opening_balance.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (Opsional)</label>
          <textarea
            {...register('notes')}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[80px]"
            placeholder="Tambahkan catatan jika perlu..."
          />
        </div>

        <div className="flex justify-between items-center pt-4">
          {onDelete && (
            <div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Yakin hapus?</span>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                    Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Hapus Periode
                </button>
              )}
            </div>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Perbarui Periode
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
