// hooks/useEmployeesCache.ts
'use client';

import { useState, useEffect } from 'react';
import { Employee } from '@/types/employee';

// Global cache
let globalEmployeesCache: Employee[] | null = null;
let globalEmployeesPromise: Promise<Employee[]> | null = null;

export function useEmployeesCache() {
  const [employees, setEmployees] = useState<Employee[]>(globalEmployeesCache || []);
  const [loading, setLoading] = useState(!globalEmployeesCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Jika sudah ada cache, langsung pakai
    if (globalEmployeesCache) {
      setEmployees(globalEmployeesCache);
      return;
    }

    // Jika sedang fetching, tunggu hasilnya
    if (globalEmployeesPromise) {
      globalEmployeesPromise
        .then(setEmployees)
        .catch(setError)
        .finally(() => setLoading(false));
      return;
    }

    // Fetch data baru
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        globalEmployeesPromise = fetch('/api/employees?limit=1000')
          .then(res => res.json())
          .then(data => data.employees || []);

        const employeesData = await globalEmployeesPromise;
        globalEmployeesCache = employeesData;
        setEmployees(employeesData);
      } catch (err) {
        setError('Failed to fetch employees');
        console.error('Error fetching employees:', err);
      } finally {
        setLoading(false);
        globalEmployeesPromise = null;
      }
    };

    fetchEmployees();
  }, []);

  return { employees, loading, error };
}