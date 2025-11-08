import { Router } from 'express';
import { register, getProfile, updateProfile } from '../../controllers/authController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = Router();

// Public routes
router.post('/register', register);

// Protected routes
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

export default router;

// Info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Suryamas Auth API',
    endpoints: {
      'POST /api/auth/register': 'Register new user',
      'GET /api/auth/profile': 'Get user profile (requires auth)',
      'PUT /api/auth/profile': 'Update user profile (requires auth)'
    }
  });
});
