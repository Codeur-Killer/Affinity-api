import { Router } from 'express';
import { list, readOne, readAll } from './notifications.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.patch('/read-all', readAll);
router.patch('/:id/read', readOne);

export default router;
