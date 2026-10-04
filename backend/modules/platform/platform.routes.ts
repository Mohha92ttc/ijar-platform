import { Router } from 'express';
import { PlatformController } from './platform.controller';

const router = Router();
const controller = new PlatformController();

router.get('/transfer-info', controller.getTransferInfo);
router.get('/info', controller.getPublicInfo);

export default router;
