import { Router } from 'express';
import { EquipmentController } from './equipment.controller';

const router = Router();
const equipmentController = new EquipmentController();

// Public search and view (static paths before /:id)
router.get('/search', equipmentController.search);
router.get('/categories', equipmentController.getCategories);
router.get('/owner/:ownerId', equipmentController.getByOwner);
router.get('/', equipmentController.list);
router.get('/:id', equipmentController.getById);

import { authenticateToken, requireRole } from '../auth/auth.middleware';

// Owner & Admin specific routes
router.post('/', authenticateToken, requireRole(['owner', 'admin']), equipmentController.create);
router.put('/:id', authenticateToken, requireRole(['owner', 'admin']), equipmentController.update);
router.delete('/:id', authenticateToken, requireRole(['owner', 'admin']), equipmentController.delete);

// Category Management (Admin only)
router.post('/categories', authenticateToken, requireRole(['admin']), equipmentController.addCategory);
router.delete('/categories/:id', authenticateToken, requireRole(['admin']), equipmentController.deleteCategory);

export default router;
