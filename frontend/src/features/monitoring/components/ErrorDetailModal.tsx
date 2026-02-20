import React from "react";
import {
  X,
  Copy,
  Terminal,
  Monitor,
  User,
  Globe,
  Activity,
} from "lucide-react";
import type { ErrorLogRecord } from "../types";
import { useToast } from "@/contexts/ToastContext";

interface ErrorDetailModalProps {
  log: ErrorLogRecord | null;
  onClose: () => void;
}

export const ErrorDetailModal: React.FC<ErrorDetailModalProps> = ({
  log,
  onClose,
}) => {
  const { success } = useToast();

  if (!log) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    success("Copied to clipboard");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                log.severity === "CRITICAL" || log.severity === "HIGH"
                  ? "bg-red-50 text-red-600"
                  : "bg-yellow-50 text-yellow-600"
              }`}
            >
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {log.error_name}
              </h2>
              <p className="text-sm text-gray-500 font-mono">{log.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Message */}
          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-1 uppercase tracking-wider">
              Error Message
            </h3>
            <p className="text-red-900 dark:text-red-200 font-medium break-words">
              {log.error_message}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Metadata Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Information
              </h3>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500">Module / Submodule</p>
                    <p className="text-sm font-medium dark:text-gray-200">
                      {log.module} / {log.submodule || "Default"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <User className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-xs text-gray-500">User Context</p>
                    <p className="text-sm font-medium dark:text-gray-200">
                      {log.user_email || "Anonymous"} ({log.user_id || "N/A"})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <Globe className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-500">Route / URL</p>
                    <p className="text-sm font-medium dark:text-gray-200 truncate max-w-[300px]">
                      {log.route || log.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <Monitor className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="text-xs text-gray-500">User Agent</p>
                    <p className="text-xs font-medium dark:text-gray-400 truncate max-w-[300px]">
                      {log.user_agent}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Context JSON */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Context Data
                </h3>
                <button
                  onClick={() =>
                    handleCopy(JSON.stringify(log.context, null, 2))
                  }
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                >
                  <Copy className="w-3 h-3" /> Copy JSON
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs overflow-auto h-48 border border-gray-800 shadow-inner">
                {JSON.stringify(log.context, null, 2)}
              </pre>
            </div>
          </div>

          {/* Stack Trace */}
          {log.error_stack && (
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider font-mono">
                  Stack Trace
                </h3>
                <button
                  onClick={() => handleCopy(log.error_stack || "")}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                >
                  <Copy className="w-3 h-3" /> Copy Stack
                </button>
              </div>
              <pre className="bg-gray-50 dark:bg-gray-900/80 p-6 rounded-xl text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-64 font-mono leading-relaxed border dark:border-gray-800 whitespace-pre-wrap">
                {log.error_stack}
              </pre>
            </div>
          )}

          {/* Business Impact */}
          {log.business_impact && (
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-400 mb-1 uppercase tracking-wider">
                Business Impact
              </h3>
              <p className="text-blue-900 dark:text-blue-200 text-sm">
                {log.business_impact}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 dark:bg-blue-600 text-white rounded-xl hover:bg-black dark:hover:bg-blue-700 transition-all font-medium shadow-lg shadow-gray-200 dark:shadow-none"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
