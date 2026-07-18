import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getStats, applyCode } from './referral.controller';

const router = Router();

router.use(authenticate);
router.get('/stats', getStats);
router.post('/use',  applyCode);

export default router;
