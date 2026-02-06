/**
 * Error Registry Utility
 * Dynamic loading dan checking untuk module error classes
 */

import { ERROR_REGISTRY, ErrorRegistryKey } from '../config/error-registry';

// Cache untuk loaded error classes
const errorClassCache = new Map<ErrorRegistryKey, new (...args: any[]) => Error>();

type ErrorClass = new (...args: any[]) => Error;

/**
 * Load error class dari registry secara dynamic
 */
export async function loadErrorClass(key: ErrorRegistryKey): Promise<ErrorClass | null> {
  // Check cache first
  if (errorClassCache.has(key)) {
    return errorClassCache.get(key)!;
  }

  const config = ERROR_REGISTRY[key];
  if (!config) {
    console.warn(`Error registry key not found: ${key}`);
    return null;
  }

  try {
    // Dynamic import
    const module = await import(config.importPath);
    const ErrorClass = module[config.name] as ErrorClass;
    
    if (ErrorClass && typeof ErrorClass === 'function') {
      errorClassCache.set(key, ErrorClass);
      return ErrorClass;
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to load error class: ${config.name}`, error);
    return null;
  }
}

/**
 * Check apakah error adalah instance dari module error class
 */
export async function isModuleError(
  error: unknown,
  key: ErrorRegistryKey
): Promise<boolean> {
  // Fast path: check name property
  if (error instanceof Error && error.name === ERROR_REGISTRY[key].name) {
    return true;
  }

  // Slow path: load and check instanceof
  const ErrorClass = await loadErrorClass(key);
  if (ErrorClass && error instanceof Error) {
    return error instanceof ErrorClass;
  }

  return false;
}

/**
 * Check apakah error adalah instance dari registered error (by name)
 */
export async function isRegisteredError(error: unknown, errorName: string): Promise<boolean> {
  // Find the key for this error name
  const key = Object.keys(ERROR_REGISTRY).find(
    (k) => ERROR_REGISTRY[k as ErrorRegistryKey].name === errorName
  ) as ErrorRegistryKey | undefined;

  if (!key) {
    return false;
  }

  return isModuleError(error, key);
}

/**
 * Get semua registered error instances dari error
 * Berguna untuk debugging atau logging
 */
export async function identifyError(error: unknown): Promise<string[]> {
  const identified: string[] = [];

  if (!(error instanceof Error)) {
    return identified;
  }

  // Check by name first (fast path)
  for (const [key, config] of Object.entries(ERROR_REGISTRY)) {
    if (error.name === config.name) {
      identified.push(config.name);
      break;
    }
  }

  // If not found by name, try instanceof checks
  if (identified.length === 0) {
    for (const key of Object.keys(ERROR_REGISTRY) as ErrorRegistryKey[]) {
      const isMatch = await isModuleError(error, key);
      if (isMatch) {
        identified.push(ERROR_REGISTRY[key].name);
        break;
      }
    }
  }

  return identified;
}

/**
 * Clear error class cache
 * Berguna untuk testing
 */
export function clearErrorCache(): void {
  errorClassCache.clear();
}

/**
 * Pre-load semua error classes
 * Untuk performance di production
 */
export async function preloadAllErrorClasses(): Promise<void> {
  const keys = Object.keys(ERROR_REGISTRY) as ErrorRegistryKey[];
  
  await Promise.all(
    keys.map(async (key) => {
      await loadErrorClass(key);
    })
  );

  console.log(`Pre-loaded ${errorClassCache.size} error classes`);
}

