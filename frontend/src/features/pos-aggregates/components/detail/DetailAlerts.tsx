import React from "react";
import type { AlertState } from "./shared";

interface Props {
  alerts: AlertState[];
}

export const DetailAlerts: React.FC<Props> = ({ alerts }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, idx) => (
        <div
          key={idx}
          className={`rounded-md border px-3 py-2.5 ${
            alert.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
              : alert.type === 'warning'
              ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
              : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className="flex gap-2">
            <div className={`shrink-0 mt-0.5 ${
              alert.type === 'error' ? 'text-red-500' : alert.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
            }`}>
              {alert.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold ${
                alert.type === 'error' ? 'text-red-800 dark:text-red-200'
                : alert.type === 'warning' ? 'text-yellow-800 dark:text-yellow-200'
                : 'text-blue-800 dark:text-blue-200'
              }`}>
                {alert.title}
              </div>
              <p className={`text-[11px] mt-0.5 ${
                alert.type === 'error' ? 'text-red-700 dark:text-red-300'
                : alert.type === 'warning' ? 'text-yellow-700 dark:text-yellow-300'
                : 'text-blue-700 dark:text-blue-300'
              }`}>
                {alert.message}
              </p>
              {alert.details && (
                <div className="mt-1 space-y-0.5">
                  {alert.details.map((d, i) => (
                    <div key={i} className="text-[10px] text-gray-600 dark:text-gray-400">{d}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
