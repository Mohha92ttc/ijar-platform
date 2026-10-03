import { Router } from 'express';
import { EquipmentController } from './equipment.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();
const equipmentController = new EquipmentController();

// Public
router.get('/search', equipmentController.search);
router.get('/categories', equipmentController.getCategories);
router.get('/partners', equipmentController.listPartners);
router.get('/owner/:ownerId', equipmentController.getByOwner);

// Category management BEFORE /:id catch-alls
router.post('/categories', authenticateToken, requireRole(['admin']), equipmentController.addCategory);
router.delete('/categories/:id', authenticateToken, requireRole(['admin']), equipmentController.deleteCategory);

router.get('/', equipmentController.list);
router.post('/', authenticateToken, requireRole(['owner', 'admin']), equipmentController.create);
router.get('/:id', equipmentController.getById);
router.put('/:id', authenticateToken, requireRole(['owner', 'admin']), equipmentController.update);
router.delete('/:id', authenticateToken, requireRole(['owner', 'admin']), equipmentController.delete);

export default router;
