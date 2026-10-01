import { Router } from 'express';
import { PlatformController } from './platform.controller';

const router = Router();
const controller = new PlatformController();

router.get('/transfer-info', controller.getTransferInfo);

export default router;
