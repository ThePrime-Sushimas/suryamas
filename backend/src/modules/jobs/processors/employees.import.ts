/**
 * Employees Import Processor
 */

import * as XLSX from 'xlsx'
import { employeesRepository } from '@/modules/employees/employees.repository'
import type { EmployeeCreatePayload, EmployeeFilter } from '@/modules/employees/employees.types'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { deleteTempFile } from '../jobs.util'
import { JobProcessor } from '../jobs.worker'

/**
 * Safely convert a value to string
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/**
 * Safely convert a value to string or null
 */
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str || null
}

export const processEmployeesImport: JobProcessor = async (
  jobId: string,
  userId: string,
  metadata: any
) => {
  let filePath: string | null = null

  try {
    logInfo('Processing employees import', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Get file path from metadata with type checking
    const rawFilePath = metadata?.filePath
    if (!rawFilePath || typeof rawFilePath !== 'string') {
      throw new Error('File path not provided in metadata')
    }
    filePath = rawFilePath

    // Read Excel file
    const workbook = XLSX.readFile(filePath)
    const sheetName = metadata?.sheetName || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Parse data
    const data = XLSX.utils.sheet_to_json(worksheet)

    await jobsService.updateProgress(jobId, 40, userId)

    // Process import - create or update employees
    const skipDuplicates = metadata?.skipDuplicates || false

    const results = {
      total: data.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[]
    }

    await jobsService.updateProgress(jobId, 50, userId)

    // Process in batches
    const batchSize = 50
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)

      for (const [index, row] of batch.entries()) {
        try {
          const rowNum = i + index + 2 // +2 for header row and 0-index
          const rowData = row as Record<string, unknown>
          
          // Type-safe field extraction using helper functions
          const employeeId = toString(rowData['Employee ID'] || rowData['employee_id'])
          const fullName = toString(rowData['Full Name'] || rowData['full_name'])
          const jobPosition = toString(rowData['Job Position'] || rowData['job_position'])
          
          const employeeData: EmployeeCreatePayload = {
            employee_id: employeeId,
            full_name: fullName,
            job_position: jobPosition,
            brand_name: toString(rowData['Brand'] || rowData['brand_name']),
            join_date: toString(rowData['Join Date'] || rowData['join_date']),
            status_employee: toString(rowData['Status'] || rowData['status_employee'] || 'Permanent') as any,
            email: toStringOrNull(rowData['Email'] || rowData['email']),
            mobile_phone: toStringOrNull(rowData['Phone'] || rowData['mobile_phone']),
            nik: toStringOrNull(rowData['NIK'] || rowData['nik']),
            birth_date: toStringOrNull(rowData['Birth Date'] || rowData['birth_date']),
            birth_place: toStringOrNull(rowData['Birth Place'] || rowData['birth_place']),
            gender: toStringOrNull(rowData['Gender'] || rowData['gender']) as any,
            religion: toStringOrNull(rowData['Religion'] || rowData['religion']) as any,
            marital_status: toStringOrNull(rowData['Marital Status'] || rowData['marital_status']) as any,
            ptkp_status: toString(rowData['PTKP Status'] || rowData['ptkp_status'] || 'TK/0') as any,
            bank_name: toStringOrNull(rowData['Bank Name'] || rowData['bank_name']),
            bank_account: toStringOrNull(rowData['Bank Account'] || rowData['bank_account']),
            bank_account_holder: toStringOrNull(rowData['Account Holder'] || rowData['bank_account_holder']),
            citizen_id_address: toStringOrNull(rowData['Address'] || rowData['citizen_id_address']),
          }

          if (!employeeData.employee_id || !employeeData.full_name || !employeeData.job_position) {
            results.failed++
            results.errors.push(`Row ${rowNum}: Missing required fields (employee_id, full_name, job_position)`)
            continue
          }

          // Check if employee exists by employee_id
          const filter: EmployeeFilter = { search: employeeData.employee_id }
          const existingEmployees = await employeesRepository.exportData(filter)
          const existing = existingEmployees.find((e: any) => e.employee_id === employeeData.employee_id)

          if (existing) {
            if (skipDuplicates) {
              results.skipped++
            } else {
              await employeesRepository.updateById(existing.id, {
                full_name: employeeData.full_name,
                job_position: employeeData.job_position,
                brand_name: employeeData.brand_name,
                join_date: employeeData.join_date,
                status_employee: employeeData.status_employee,
                email: employeeData.email,
                mobile_phone: employeeData.mobile_phone,
                nik: employeeData.nik,
                birth_date: employeeData.birth_date,
                birth_place: employeeData.birth_place,
                gender: employeeData.gender,
                religion: employeeData.religion,
                marital_status: employeeData.marital_status,
                ptkp_status: employeeData.ptkp_status,
                bank_name: employeeData.bank_name,
                bank_account: employeeData.bank_account,
                bank_account_holder: employeeData.bank_account_holder,
                citizen_id_address: employeeData.citizen_id_address,
              } as any)
              results.updated++
            }
          } else {
            await employeesRepository.create(employeeData)
            results.created++
          }
        } catch (err) {
          results.failed++
          results.errors.push(`Row ${i + index + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }

      // Update progress (use Math.round to convert float to integer)
      const progress = Math.round(50 + Math.min(40, (i / data.length) * 40))
      await jobsService.updateProgress(jobId, progress, userId)
    }

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Employees import completed', {
      job_id: jobId,
      total: results.total,
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      failed: results.failed
    })

    // Clean up temp file
    if (filePath) {
      await deleteTempFile(filePath)
    }

    return {
      filePath: '',
      fileName: '',
      importResults: results
    }
  } catch (error) {
    logError('Employees import failed', { job_id: jobId, error })
    
    // Clean up temp file on error
    if (filePath) {
      await deleteTempFile(filePath).catch(cleanupErr => {
        logError('Failed to cleanup temp file after error', { file_path: filePath, error: cleanupErr })
      })
    }
    
    throw error
  }
}

