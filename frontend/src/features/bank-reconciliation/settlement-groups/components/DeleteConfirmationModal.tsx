/**
 * Delete Confirmation Modal Component
 * Modal for confirming deletion (HARD DELETE - no restore option)
 */

import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Info } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  settlementNumber: string;
  isLoading?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  settlementNumber,
  isLoading = false,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setConfirmed(true);
    try {
      await onConfirm();
    } catch {
      // Error is handled by parent component
    } finally {
      setConfirmed(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="relative inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ring-1 ring-black/5">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="shrink-0">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Hapus Settlement Group
              </h3>
              <p className="text-sm text-gray-500">
                Tindakan ini permanen dan tidak dapat dibatalkan
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <div className="mb-4">
              <p className="text-gray-700">
                Apakah Anda yakin ingin menghapus settlement group{" "}
                <span className="font-semibold text-gray-900">{settlementNumber}</span>?
              </p>
            </div>

            {/* Info about what happens */}
            <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-red-50 text-red-700 mb-4">
              <RotateCcw className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Aggregate dan bank statement akan dikembalikan ke status{" "}
                <span className="font-medium">UNRECONCILED</span>. 
                Mereka dapat dipilih kembali untuk reconciliation.
              </p>
            </div>

            {/* Warning about permanent deletion */}
            <div className="flex items-start gap-2 text-sm text-gray-600 bg-amber-50 p-3 rounded-lg">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Settlement group akan dihapus secara permanen dari database dan tidak dapat dipulihkan.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={isLoading || confirmed}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || confirmed}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-medium shadow-sm shadow-red-200"
            >
              {(isLoading || confirmed) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  <span>Hapus Permanen</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

