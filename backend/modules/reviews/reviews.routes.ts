import { Router } from 'express';
import { ReviewController } from './reviews.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();
const reviewController = new ReviewController();

router.post('/', authenticateToken, requireRole(['customer']), reviewController.create);
router.get('/equipment/:equipmentId', reviewController.getByEquipment);
router.get('/owner/:ownerId', authenticateToken, requireRole(['owner', 'admin']), reviewController.getByOwner);
router.get('/:id', reviewController.getById);

export default router;
