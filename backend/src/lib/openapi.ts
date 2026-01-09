import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z)

export { z, ZodError } from 'zod'
export type { ZodTypeAny } from 'zod'
