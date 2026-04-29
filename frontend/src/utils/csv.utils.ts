export function escapeCsv(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}
