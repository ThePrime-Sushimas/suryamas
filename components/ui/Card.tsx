import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ children, className }: CardProps) => {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('px-6 py-4 border-b border-gray-200', className)}>
    {children}
  </div>
);

export const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h3 className={cn('text-lg font-semibold text-gray-900', className)}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn('text-sm text-gray-600 mt-1', className)}>
    {children}
  </p>
);

export const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('px-6 py-4', className)}>
    {children}
  </div>
);

export const CardFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('px-6 py-4 border-t border-gray-200', className)}>
    {children}
  </div>
);