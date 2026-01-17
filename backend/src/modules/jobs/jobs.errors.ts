/**
 * Jobs Module Errors
 */

export class JobError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'JobError'
  }
}

export const JobErrors = {
  NOT_FOUND: () => new JobError('Job not found', 'JOB_NOT_FOUND', 404),
  ALREADY_PROCESSING: () => new JobError('User already has a job processing', 'JOB_ALREADY_PROCESSING', 409),
  INVALID_STATUS: (status: string) => new JobError(`Invalid job status: ${status}`, 'INVALID_STATUS', 400),
  PROCESSING_FAILED: (message: string) => new JobError(`Job processing failed: ${message}`, 'PROCESSING_FAILED', 500),
  FILE_UPLOAD_FAILED: (message: string) => new JobError(`File upload failed: ${message}`, 'FILE_UPLOAD_FAILED', 500),
  FILE_NOT_FOUND: () => new JobError('Job result file not found', 'FILE_NOT_FOUND', 404),
  EXPIRED: () => new JobError('Job result has expired', 'JOB_EXPIRED', 410),
}
