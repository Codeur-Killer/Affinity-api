import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireVip }   from '../../middleware/vip.middleware';
import * as ctrl from './vip.controller';

const router = Router();

router.use(authenticate, requireVip);

router.get('/dashboard', ctrl.dashboard);

export default router;
