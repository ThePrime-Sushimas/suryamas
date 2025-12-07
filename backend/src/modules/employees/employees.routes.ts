import { Router } from 'express'
import { employeesController } from './employees.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

// Search
router.get('/search', authenticate, (req, res) => employeesController.search(req, res))
router.get('/autocomplete', authenticate, (req, res) => employeesController.autocomplete(req, res))

// Employee CRUD
router.post('/', authenticate, (req, res) => employeesController.create(req, res))
router.delete('/:id', authenticate, (req, res) => employeesController.delete(req, res))
router.get('/profile', authenticate, (req, res) => employeesController.getProfile(req, res))
router.put('/profile', authenticate, (req, res) => employeesController.updateProfile(req, res))

export default router