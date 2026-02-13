/**
 * Settlement Status Badge Component
 * Displays settlement group status with appropriate colors
 */

import React from 'react';
import type { SettlementGroupStatusType } from '../types/settlement-groups.types';
import { SettlementGroupStatusColors, SettlementGroupStatusLabels } from '../types/settlement-groups.types';

interface SettlementStatusBadgeProps {
  status: SettlementGroupStatusType | string | undefined | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const defaultColors = {
  bg: 'bg-gray-100',
  text: 'text-gray-800',
  border: 'border-gray-200',
};

export const SettlementStatusBadge: React.FC<SettlementStatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  // Handle undefined, null, or unknown status
  const safeStatus = status || 'PENDING';
  const colors = SettlementGroupStatusColors[safeStatus as keyof typeof SettlementGroupStatusColors] || defaultColors;
  const label = SettlementGroupStatusLabels[safeStatus as keyof typeof SettlementGroupStatusLabels] || safeStatus;

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
