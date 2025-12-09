import { Router } from 'express'
import { employeesController } from './employees.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { upload } from '../../middleware/upload.middleware'

const router = Router()

// List with pagination & sort
router.get('/', authenticate, paginationMiddleware, sortMiddleware, (req, res) => employeesController.list(req as any, res))

// Search with pagination & sort & filter
router.get('/search', authenticate, paginationMiddleware, sortMiddleware, filterMiddleware, (req, res) => employeesController.search(req as any, res))
router.get('/autocomplete', authenticate, (req, res) => employeesController.autocomplete(req, res))
router.get('/filter-options', authenticate, (req, res) => employeesController.getFilterOptions(req, res))

// Profile (harus di atas /:id)
router.get('/profile', authenticate, (req, res) => employeesController.getProfile(req, res))
router.put('/profile', authenticate, (req, res) => employeesController.updateProfile(req, res))
router.post('/profile/picture', authenticate, upload.single('picture'), (req, res) => employeesController.uploadProfilePicture(req, res))

// Employee CRUD
router.post('/', authenticate, upload.single('profile_picture'), (req, res) => employeesController.create(req, res))
router.get('/:id', authenticate, (req, res) => employeesController.getById(req, res))
router.delete('/:id', authenticate, (req, res) => employeesController.delete(req, res))

export default router
