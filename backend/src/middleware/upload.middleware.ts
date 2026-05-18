import multer from 'multer'
import { Request } from 'express'

const storage = multer.memoryStorage()

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB dont change the limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedPrefixes = ['image/']
    const allowedExact = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    if (
      allowedPrefixes.some((p) => file.mimetype.startsWith(p)) ||
      allowedExact.includes(file.mimetype)
    ) {
      cb(null, true)
    } else {
      cb(null, false)
    }
  }
})
