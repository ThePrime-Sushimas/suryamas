/**
 * Difference Indicator Component
 * Shows the difference between expected and actual amounts with visual indicators
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DifferenceIndicatorProps {
  difference: number;
  totalAmount: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const DifferenceIndicator: React.FC<DifferenceIndicatorProps> = ({
  difference,
  totalAmount,
  showPercentage = true,
  size = 'md',
}) => {
  const percentage = totalAmount !== 0 ? Math.abs((difference / totalAmount) * 100) : 0;
  const isPositive = difference > 0;
  const isZero = difference === 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getColorClasses = () => {
    if (isZero) return 'text-gray-600 bg-gray-50 border-gray-200';
    if (isPositive) return 'text-green-700 bg-green-50 border-green-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const getIcon = () => {
    if (isZero) return <Minus className="h-3 w-3" />;
    if (isPositive) return <TrendingUp className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
    lg: 'px-3 py-2 text-base',
  };

  return (
    <div className={`inline-flex items-center gap-1 rounded-md border ${getColorClasses()} ${sizeClasses[size]}`}>
      {getIcon()}
      <span className="font-medium">
        {formatCurrency(Math.abs(difference))}
      </span>
      {showPercentage && !isZero && (
        <span className="text-xs opacity-75">
          ({percentage.toFixed(1)}%)
        </span>
      )}
    </div>
  );
};
