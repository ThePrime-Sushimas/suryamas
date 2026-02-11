/**
 * Settlement Status Badge Component
 * Displays settlement group status with appropriate colors
 */

import React from 'react';
import type { SettlementGroupStatusType } from '../types/settlement-groups.types';
import { SettlementGroupStatusColors, SettlementGroupStatusLabels } from '../types/settlement-groups.types';

interface SettlementStatusBadgeProps {
  status: SettlementGroupStatusType;
  deleted_at?: string | null; // Soft delete timestamp for UNDO status
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const SettlementStatusBadge: React.FC<SettlementStatusBadgeProps> = ({
  status,
  deleted_at,
  size = 'md',
  showLabel = true,
}) => {
  // If deleted_at exists, show as UNDO status regardless of status field
  const displayStatus = deleted_at ? 'UNDO' : status;

  const colors = SettlementGroupStatusColors[displayStatus as keyof typeof SettlementGroupStatusColors];
  const label = SettlementGroupStatusLabels[displayStatus as keyof typeof SettlementGroupStatusLabels];

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
    lg: 'px-3 py-2 text-base',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${colors.bg} ${colors.text} ${colors.border} border ${sizeClasses[size]}`}
    >
      {showLabel && label}
    </span>
  );
};
