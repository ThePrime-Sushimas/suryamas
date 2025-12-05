import { Router } from 'express'
import { employeesController } from './employees.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

router.get('/profile', authenticate, (req, res) => employeesController.getProfile(req, res))
router.put('/profile', authenticate, (req, res) => employeesController.updateProfile(req, res))

export default router