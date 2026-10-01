import { Router } from 'express';
import { ReviewController } from './reviews.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();
const reviewController = new ReviewController();

// Create review
router.post('/', authenticateToken, requireRole(['customer']), reviewController.create);

// Get reviews
router.get('/:id', reviewController.getById);
router.get('/equipment/:equipmentId', reviewController.getByEquipment);
router.get('/owner/:ownerId', reviewController.getByOwner);

export default router;
