export const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

export const calculateYearsOfService = (joinDate: string | null, resignDate?: string | null): { years: number; months: number; days: number } | null => {
  if (!joinDate) return null;
  const join = new Date(joinDate);
  const end = resignDate ? new Date(resignDate) : new Date();
  
  let years = end.getFullYear() - join.getFullYear();
  let months = end.getMonth() - join.getMonth();
  let days = end.getDate() - join.getDate();
  
  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  return { years, months, days };
};
