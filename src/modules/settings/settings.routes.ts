import { Router } from 'express';
import { get, update, patchFcmToken } from './settings.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', get);
router.put('/', update);
router.patch('/fcm-token', patchFcmToken);

export default router;
