import { Router } from 'express'
import { employeeController } from '../controllers/employee.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.get('/profile', authenticate, (req, res) => employeeController.getProfile(req, res))
router.put('/profile', authenticate, (req, res) => employeeController.updateProfile(req, res))

export default router