export type SortDirection = 'asc' | 'desc';

export function sortByString(a: string, b: string, direction: SortDirection): number {
  const aValue = a.toLowerCase();
  const bValue = b.toLowerCase();
  
  if (aValue < bValue) return direction === 'asc' ? -1 : 1;
  if (aValue > bValue) return direction === 'asc' ? 1 : -1;
  return 0;
}

export function sortByNumber(a: number, b: number, direction: SortDirection): number {
  if (a < b) return direction === 'asc' ? -1 : 1;
  if (a > b) return direction === 'asc' ? 1 : -1;
  return 0;
}

export function sortByDate(a: Date | string, b: Date | string, direction: SortDirection): number {
  const dateA = typeof a === 'string' ? new Date(a) : a;
  const dateB = typeof b === 'string' ? new Date(b) : b;
  
  const timeA = dateA.getTime();
  const timeB = dateB.getTime();
  
  if (timeA < timeB) return direction === 'asc' ? -1 : 1;
  if (timeA > timeB) return direction === 'asc' ? 1 : -1;
  return 0;
}

export function getSortValue<T>(obj: T, key: keyof T): any {
  const value = obj[key];
  
  if (typeof value === 'string') {
    return value.toLowerCase();
  }
  
  if (value instanceof Date) {
    return value.getTime();
  }
  
  return value;
}