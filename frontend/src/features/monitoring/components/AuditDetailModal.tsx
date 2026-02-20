import React from "react";
import {
  X,
  Copy,
  User,
  Activity,
  Calendar,
  Layers,
  FileJson,
} from "lucide-react";
import type { AuditLogRecord } from "../types";
import { useToast } from "@/contexts/ToastContext";

interface AuditDetailModalProps {
  log: AuditLogRecord | null;
  onClose: () => void;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({
  log,
  onClose,
}) => {
  const { success } = useToast();

  if (!log) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    success("Copied to clipboard");
  };

  const tryParse = (val: any) => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch (e) {
        return val;
      }
    }
    return val;
  };

  const oldValue = tryParse(log.old_value);
  const newValue = tryParse(log.new_value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Audit Entry: {log.action}
                </h2>
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md text-xs font-mono">
                  {log.entity_type}
                </span>
              </div>
              <p className="text-sm text-gray-500 font-mono mt-1">
                ID: {log.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Metadata Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <Calendar className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500">Timestamp</p>
                <p className="text-sm font-medium dark:text-gray-200">
                  {new Date(log.created_at).toLocaleString("id-ID")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <User className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-xs text-gray-500">Action By</p>
                <p className="text-sm font-medium dark:text-gray-200">
                  {log.user_email || "System User"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <Activity className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs text-gray-500">Target Entity</p>
                <p className="text-sm font-medium dark:text-gray-200 truncate">
                  {log.entity_id || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Diff Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Old Value */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Previous State
                  </h3>
                </div>
                {oldValue && (
                  <button
                    onClick={() =>
                      handleCopy(JSON.stringify(oldValue, null, 2))
                    }
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-400 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <pre className="p-4 text-xs font-mono text-gray-400 overflow-auto max-h-[400px] leading-relaxed">
                  {oldValue ? (
                    JSON.stringify(oldValue, null, 2)
                  ) : (
                    <span className="italic text-gray-600">
                      No previous state recorded
                    </span>
                  )}
                </pre>
              </div>
            </div>

            {/* New Value */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    New State
                  </h3>
                </div>
                {newValue && (
                  <button
                    onClick={() =>
                      handleCopy(JSON.stringify(newValue, null, 2))
                    }
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-400 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <pre className="p-4 text-xs font-mono text-emerald-400/90 overflow-auto max-h-[400px] leading-relaxed">
                  {newValue ? (
                    JSON.stringify(newValue, null, 2)
                  ) : (
                    <span className="italic text-gray-600">
                      No new state recorded
                    </span>
                  )}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-semibold shadow-lg shadow-blue-100 dark:shadow-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
