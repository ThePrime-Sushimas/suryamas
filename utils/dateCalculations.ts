// utils/dateCalculations.ts
export interface LengthOfService {
  years: number;
  months: number;
  days: number;
  formatted: string;
  detailed: string;
  totalMonths: number;
  totalDays: number;
}

export function calculateLengthOfService(
  joinDate: string, 
  resignDate: string | null = null
): LengthOfService {
  const start = new Date(joinDate);
  const end = resignDate ? new Date(resignDate) : new Date();
  
  // Ensure start date is before end date
  if (start > end) {
    return {
      years: 0,
      months: 0,
      days: 0,
      formatted: 'Invalid date range',
      detailed: 'Start date cannot be after end date',
      totalMonths: 0,
      totalDays: 0
    };
  }
  
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();
  
  // Adjust negative days
  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  // Adjust negative months
  if (months < 0) {
    years--;
    months += 12;
  }
  
  // Calculate total months and days for sorting/filtering
  const totalMonths = years * 12 + months;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  const formatted = years > 0 
    ? `${years} year${years > 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`
    : `${months} month${months !== 1 ? 's' : ''}`;
  
  const detailed = years > 0 
    ? `${years} year${years > 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''}`
    : months > 0 
      ? `${months} month${months !== 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''}`
      : `${days} day${days !== 1 ? 's' : ''}`;
  
  return {
    years,
    months,
    days,
    formatted,
    detailed,
    totalMonths,
    totalDays
  };
}

// For display purposes
export function getLengthOfServiceDisplay(joinDate: string, resignDate: string | null = null): string {
  const { formatted } = calculateLengthOfService(joinDate, resignDate);
  return formatted;
}

// For sorting by length of service
export function getLengthOfServiceInMonths(joinDate: string, resignDate: string | null = null): number {
  const { totalMonths } = calculateLengthOfService(joinDate, resignDate);
  return totalMonths;
}