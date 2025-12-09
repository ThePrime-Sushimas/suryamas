import multer from 'multer'
import { Request } from 'express'

const storage = multer.memoryStorage()

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    if (allowedTypes.some(type => file.mimetype.includes(type))) {
      cb(null, true)
    } else {
      cb(null, false)
    }
  }
})
