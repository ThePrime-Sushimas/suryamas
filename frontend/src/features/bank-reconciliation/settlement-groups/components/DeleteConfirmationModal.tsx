/**
 * Delete Confirmation Modal Component
 * Modal for confirming deletion with optional revert reconciliation status
 * 
 * DEFAULT BEHAVIOR: revertReconciliation = true
 * User can opt-out if they only want to hide from UI without reverting reconciliation
 */

import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Info, CheckCircle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (revertReconciliation: boolean) => Promise<void>;
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
  // Default: true (will revert is_reconciled to false)
  const [keepReconciled, setKeepReconciled] = useState(false);
  // revertReconciliation is opposite of keepReconciled
  const revertReconciliation = !keepReconciled;
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setConfirmed(true);
    try {
      await onConfirm(revertReconciliation);
    } catch {
      // Error is handled by parent component
    } finally {
      // Always close modal when done (success or error)
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
                Tindakan ini tidak dapat dibatalkan
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

            {/* Option: Keep Reconciled (opt-out from default) */}
            <div className={`rounded-lg p-4 mb-4 border transition-colors ${
              keepReconciled 
                ? 'bg-blue-50 border-blue-200' 
                : 'bg-gray-50 border-gray-100'
            }`}>
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    id="keepReconciled"
                    checked={keepReconciled}
                    onChange={(e) => setKeepReconciled(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="keepReconciled"
                    className="text-sm font-medium cursor-pointer"
                    style={{ 
                      color: keepReconciled ? '#1d4ed8' : '#111827' 
                    }}
                  >
                    Biarkan status reconciled tetap seperti ini
                  </label>
                  <p className="text-xs mt-1" style={{ color: keepReconciled ? '#1e40af' : '#6b7280' }}>
                    Aggregate dan bank statement akan tetap berstatus{" "}
                    <span className={`font-medium ${keepReconciled ? 'text-blue-600' : 'text-green-600'}`}>
                      RECONCILED
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Default behavior info */}
            <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
              keepReconciled 
                ? 'bg-gray-100 text-gray-600' 
                : 'bg-red-50 text-red-700'
            }`}>
              {keepReconciled ? (
                <>
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Settlement group akan disembunyikan dari list utama, tapi status 
                    reconciliation tidak berubah.
                  </p>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Aggregate dan bank statement akan dikembalikan ke status{" "}
                    <span className="font-medium">UNRECONCILED</span>. 
                    Mereka dapat dipilih kembali untuk reconciliation.
                  </p>
                </>
              )}
            </div>

            {/* Trash info */}
            <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg mt-4">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                Settlement group akan dipindahkan ke{" "}
                <span className="font-medium text-gray-900">"Terhapus"</span> dan dapat dipulihkan dari sana.
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
              className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-medium shadow-sm ${
                keepReconciled
                  ? 'bg-gray-600 hover:bg-gray-700 shadow-gray-200'
                  : 'bg-red-600 hover:bg-red-700 shadow-red-200'
              }`}
            >
              {(isLoading || confirmed) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  {!keepReconciled && <RotateCcw className="h-4 w-4" />}
                  <span>
                    {keepReconciled ? 'Hapus Saja' : 'Hapus & Pulihkan'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

