/**
 * Settlement Status Badge Component
 * Displays settlement group status with appropriate colors
 */

import React from 'react';
import type { SettlementGroupStatusType } from '../types/settlement-groups.types';
import { SettlementGroupStatusColors, SettlementGroupStatusLabels } from '../types/settlement-groups.types';

interface SettlementStatusBadgeProps {
  status: SettlementGroupStatusType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const SettlementStatusBadge: React.FC<SettlementStatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  const colors = SettlementGroupStatusColors[status as keyof typeof SettlementGroupStatusColors];
  const label = SettlementGroupStatusLabels[status as keyof typeof SettlementGroupStatusLabels];

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
