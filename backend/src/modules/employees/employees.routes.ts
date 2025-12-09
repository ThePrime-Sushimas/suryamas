import { Router } from 'express'
import { employeesController } from './employees.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'

const router = Router()

// List with pagination
router.get('/', authenticate, paginationMiddleware, (req, res) => employeesController.list(req, res))

// Search
router.get('/search', authenticate, paginationMiddleware, (req, res) => employeesController.search(req, res))
router.get('/autocomplete', authenticate, (req, res) => employeesController.autocomplete(req, res))

// Profile (harus di atas /:id)
router.get('/profile', authenticate, (req, res) => employeesController.getProfile(req, res))
router.put('/profile', authenticate, (req, res) => employeesController.updateProfile(req, res))

// Employee CRUD
router.post('/', authenticate, (req, res) => employeesController.create(req, res))
router.get('/:id', authenticate, (req, res) => employeesController.getById(req, res))
router.delete('/:id', authenticate, (req, res) => employeesController.delete(req, res))

export default router