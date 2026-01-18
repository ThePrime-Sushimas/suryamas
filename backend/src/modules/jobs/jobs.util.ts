/**
 * Jobs Utility Functions
 * Helper functions for job operations
 */

import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

const TEMP_DIR = path.join(process.cwd(), 'temp')

/**
 * Ensure temp directory exists
 */
function ensureTempDir(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }
}

/**
 * Save buffer to temporary file
 * @param buffer - File buffer
 * @param fileName - Original file name
 * @returns Full path to saved file
 */
export async function saveTempFile(buffer: Buffer, fileName: string): Promise<string> {
  ensureTempDir()

  // Use path.basename() to prevent path traversal attacks
  const baseName = path.basename(fileName)
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const uniqueName = `${randomUUID()}_${sanitizedName}`
  const filePath = path.join(TEMP_DIR, uniqueName)

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        reject(new Error(`Failed to save temp file: ${err.message}`))
      } else {
        resolve(filePath)
      }
    })
  })
}

/**
 * Delete temporary file
 * @param filePath - Path to file
 * @returns Success status
 */
export async function deleteTempFile(filePath: string): Promise<boolean> {
  if (!filePath || typeof filePath !== 'string') {
    return false
  }

  // Additional security: ensure the path is within temp directory
  const resolvedPath = path.resolve(filePath)
  if (!resolvedPath.startsWith(TEMP_DIR)) {
    console.error('Attempted to delete file outside temp directory:', filePath)
    return false
  }

  if (!fs.existsSync(resolvedPath)) {
    return false
  }

  return new Promise((resolve) => {
    fs.unlink(resolvedPath, (err) => {
      if (err) {
        console.error(`Failed to delete temp file: ${resolvedPath}`, err)
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

/**
 * Clean up job result file with proper path validation
 * @param filePath - Path to job result file
 * @returns Success status
 */
export async function cleanupJobResult(filePath: string): Promise<boolean> {
  if (!filePath || typeof filePath !== 'string') {
    return false
  }

  // Additional security: ensure the path is within temp directory
  const resolvedPath = path.resolve(filePath)
  if (!resolvedPath.startsWith(TEMP_DIR)) {
    console.error('Attempted to cleanup file outside temp directory:', filePath)
    return false
  }

  return deleteTempFile(resolvedPath)
}

/**
 * Clean up old temp files (older than 1 hour)
 */
export function cleanupOldTempFiles(): void {
  try {
    if (!fs.existsSync(TEMP_DIR)) return

    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const files = fs.readdirSync(TEMP_DIR)

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file)
      const stats = fs.statSync(filePath)

      if (stats.isFile() && stats.mtimeMs < oneHourAgo) {
        try {
          fs.unlinkSync(filePath)
          console.log(`Cleaned up old temp file: ${filePath}`)
        } catch (err) {
          console.error(`Failed to delete old temp file: ${filePath}`, err)
        }
      }
    }
  } catch (err) {
    console.error('Error cleaning up temp files:', err)
  }
}

/**
 * Get temp directory path
 */
export function getTempDir(): string {
  ensureTempDir()
  return TEMP_DIR
}

