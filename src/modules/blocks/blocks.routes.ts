import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { list, block, unblock } from './blocks.controller';

const router = Router();

router.use(authenticate);
router.get('/',           list);
router.post('/:userId',   block);
router.delete('/:userId', unblock);

export default router;
