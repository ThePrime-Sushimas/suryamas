import React from 'react';
import { cn } from '@/lib/utils';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table = ({ children, className }: TableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full divide-y divide-gray-200', className)}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <thead className={cn('bg-gray-50', className)}>
    {children}
  </thead>
);

export const TableBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <tbody className={cn('bg-white divide-y divide-gray-200', className)}>
    {children}
  </tbody>
);

export const TableRow = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <tr className={cn('hover:bg-gray-50 transition-colors', className)}>
    {children}
  </tr>
);

export const TableHead = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th className={cn(
    'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
    className
  )}>
    {children}
  </th>
);

export const TableCell = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-6 py-4 whitespace-nowrap text-sm text-gray-900', className)} {...props}>
    {children}
  </td>
);